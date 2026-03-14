"""
ML-Trainer — Training-Pipeline fuer Prognose-Korrektur-Modelle.

Trainiert auf historischen Messdaten, evaluiert mit zeitbasiertem Split,
speichert Modelle als joblib-Dateien.
"""

import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sqlalchemy import select

from app.config import settings
from app.core.database import async_session
from app.models.ml_status import MLModelStatus
from app.services.ml.features import FEATURE_SETS, build_training_data
from app.services.ml.models import create_model, create_quantile_models

logger = logging.getLogger(__name__)

FORECAST_TYPES = ["pv_correction", "load_correction", "thermal_correction"]
MIN_SAMPLES = 168  # 7 Tage stuendlich


class MLTrainer:
    """Trainiert und verwaltet ML-Korrektur-Modelle."""

    def __init__(self):
        self._model_dir = Path(settings.ml_model_dir)
        self._model_dir.mkdir(parents=True, exist_ok=True)

    async def train(
        self,
        forecast_type: str,
        days_back: int = 90,
        model_type: str = "xgboost",
    ) -> dict:
        """
        Trainiert ein Korrektur-Modell fuer den angegebenen Prognose-Typ.

        Returns: Dict mit Trainings-Metriken oder Fehlermeldung.
        """
        if forecast_type not in FORECAST_TYPES:
            return {"error": f"Unbekannter Typ: {forecast_type}", "success": False}

        logger.info("Training starte fuer %s (Typ: %s, Tage: %d)", forecast_type, model_type, days_back)

        # Trainingsdaten laden
        features_list, targets = await build_training_data(forecast_type, days_back)

        if len(features_list) < MIN_SAMPLES:
            msg = f"Zu wenig Daten: {len(features_list)} Samples (min {MIN_SAMPLES})"
            logger.warning("%s: %s", forecast_type, msg)
            return {"error": msg, "success": False, "samples": len(features_list)}

        # Feature-Matrix aufbauen
        feature_names = FEATURE_SETS[forecast_type]
        X = [[row.get(f, 0.0) for f in feature_names] for row in features_list]
        y = targets

        # Zeitbasierter Split: letzte 7 Tage = Validation
        val_size = min(168, len(X) // 5)
        X_train, X_val = X[:-val_size], X[-val_size:]
        y_train, y_val = y[:-val_size], y[-val_size:]

        # Hauptmodell trainieren
        model = create_model(model_type)
        model.fit(X_train, y_train)

        # Evaluieren
        y_pred = model.predict(X_val)
        metrics = self._evaluate(y_val, y_pred)

        # Quantil-Modelle trainieren
        lower_model, upper_model = create_quantile_models()
        lower_model.fit(X_train, y_train)
        upper_model.fit(X_train, y_train)

        # Feature Importance
        importances = {}
        if hasattr(model, "feature_importances_"):
            for name, imp in zip(feature_names, model.feature_importances_):
                importances[name] = round(float(imp), 4)

        # Modelle speichern
        model_path = self._model_dir / f"{forecast_type}_latest.joblib"
        lower_path = self._model_dir / f"{forecast_type}_lower.joblib"
        upper_path = self._model_dir / f"{forecast_type}_upper.joblib"

        joblib.dump(model, model_path)
        joblib.dump(lower_model, lower_path)
        joblib.dump(upper_model, upper_path)

        # Status in DB speichern
        await self._save_status(
            forecast_type=forecast_type,
            model_type=model_type,
            metrics=metrics,
            training_samples=len(X_train),
            feature_count=len(feature_names),
            model_path=str(model_path),
            importances=importances,
        )

        logger.info(
            "%s trainiert: MAE=%.3f, RMSE=%.3f, R2=%.3f (%d Samples)",
            forecast_type, metrics["mae"], metrics["rmse"], metrics["r2"], len(X_train),
        )

        return {
            "success": True,
            "forecast_type": forecast_type,
            "training_samples": len(X_train),
            "validation_samples": len(X_val),
            "feature_count": len(feature_names),
            "metrics": metrics,
            "feature_importance": importances,
        }

    async def train_all(self, days_back: int = 90) -> dict:
        """Trainiert alle Korrektur-Modelle + thermisches Lernen."""
        results = {}
        for ft in FORECAST_TYPES:
            try:
                results[ft] = await self.train(ft, days_back)
            except Exception as e:
                logger.exception("Training fehlgeschlagen fuer %s", ft)
                results[ft] = {"error": str(e), "success": False}

        # Thermisches Lernen (Raum-Parameter)
        try:
            from app.services.ml.thermal_learner import thermal_learner
            thermal_results = await thermal_learner.learn_all(days_back=min(days_back, 28))
            success_count = sum(1 for r in thermal_results.values() if r.get("success"))
            results["thermal_learning"] = {
                "success": True,
                "rooms_total": len(thermal_results),
                "rooms_learned": success_count,
            }
            logger.info("Thermisches Lernen: %d/%d Raeume erfolgreich", success_count, len(thermal_results))
        except Exception as e:
            logger.warning("Thermisches Lernen fehlgeschlagen: %s", e)
            results["thermal_learning"] = {"success": False, "error": str(e)}

        return results

    def _evaluate(self, y_true: list[float], y_pred) -> dict:
        """Berechnet Evaluationsmetriken."""
        n = len(y_true)
        if n == 0:
            return {"mae": 0, "rmse": 0, "r2": 0}

        errors = [y_true[i] - float(y_pred[i]) for i in range(n)]
        mae = sum(abs(e) for e in errors) / n
        rmse = (sum(e ** 2 for e in errors) / n) ** 0.5

        # R2
        mean_y = sum(y_true) / n
        ss_res = sum(e ** 2 for e in errors)
        ss_tot = sum((y - mean_y) ** 2 for y in y_true)
        r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0

        return {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "r2": round(r2, 4),
        }

    async def _save_status(
        self,
        forecast_type: str,
        model_type: str,
        metrics: dict,
        training_samples: int,
        feature_count: int,
        model_path: str,
        importances: dict,
    ):
        """Speichert oder aktualisiert den Modell-Status in der DB."""
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(MLModelStatus).where(MLModelStatus.id == forecast_type)
                )
                entry = result.scalar_one_or_none()

                now = datetime.now(timezone.utc)

                if entry:
                    entry.model_type = model_type
                    entry.trained_at = now
                    entry.training_samples = training_samples
                    entry.feature_count = feature_count
                    entry.mae = metrics["mae"]
                    entry.rmse = metrics["rmse"]
                    entry.r2_score = metrics["r2"]
                    entry.model_path = model_path
                    entry.is_active = True
                    # activation_mode bleibt unveraendert (User-gesteuert)
                    entry.metadata_json = {"feature_importance": importances}
                else:
                    db.add(MLModelStatus(
                        id=forecast_type,
                        model_type=model_type,
                        trained_at=now,
                        training_samples=training_samples,
                        feature_count=feature_count,
                        mae=metrics["mae"],
                        rmse=metrics["rmse"],
                        r2_score=metrics["r2"],
                        model_path=model_path,
                        is_active=True,
                        activation_mode="passive",
                        metadata_json={"feature_importance": importances},
                    ))

                await db.commit()
        except Exception as e:
            logger.warning("ML-Status Speichern fehlgeschlagen: %s", e)


# Singleton
ml_trainer = MLTrainer()
