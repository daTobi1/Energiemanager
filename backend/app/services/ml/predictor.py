"""
ML-Predictor — Laedt trainierte Modelle und berechnet Korrekturen.

Wird von den Forecast-Services aufgerufen:
    physics_value + ml_predictor.predict_correction("pv_correction", features)
"""

import logging
from pathlib import Path

import joblib

from app.config import settings
from app.services.ml.features import FEATURE_SETS

logger = logging.getLogger(__name__)


class MLPredictor:
    """Laedt und verwaltet ML-Modelle fuer Prognose-Korrekturen."""

    def __init__(self):
        self._model_dir = Path(settings.ml_model_dir)
        self._models: dict = {}        # forecast_type -> model
        self._lower_models: dict = {}  # forecast_type -> quantile model
        self._upper_models: dict = {}  # forecast_type -> quantile model
        self._loaded = False

    def _ensure_loaded(self):
        """Laedt Modelle beim ersten Zugriff."""
        if self._loaded:
            return
        self.reload_models()
        self._loaded = True

    def reload_models(self):
        """Laedt alle vorhandenen Modelle von der Festplatte."""
        self._models.clear()
        self._lower_models.clear()
        self._upper_models.clear()

        if not self._model_dir.exists():
            return

        for forecast_type in FEATURE_SETS:
            main_path = self._model_dir / f"{forecast_type}_latest.joblib"
            lower_path = self._model_dir / f"{forecast_type}_lower.joblib"
            upper_path = self._model_dir / f"{forecast_type}_upper.joblib"

            try:
                if main_path.exists():
                    self._models[forecast_type] = joblib.load(main_path)
                    logger.info("ML-Modell geladen: %s", forecast_type)

                if lower_path.exists():
                    self._lower_models[forecast_type] = joblib.load(lower_path)
                if upper_path.exists():
                    self._upper_models[forecast_type] = joblib.load(upper_path)
            except Exception as e:
                logger.warning("Modell laden fehlgeschlagen fuer %s: %s", forecast_type, e)

    def is_available(self, forecast_type: str) -> bool:
        """Prueft ob ein trainiertes Modell verfuegbar ist."""
        self._ensure_loaded()
        return forecast_type in self._models

    def predict_correction(
        self,
        forecast_type: str,
        features: dict,
    ) -> tuple[float, float, float]:
        """
        Berechnet ML-Korrektur fuer eine Physik-Prognose.

        Args:
            forecast_type: z.B. "pv_correction"
            features: Dict mit Feature-Werten

        Returns:
            (correction_kw, lower_bound, upper_bound)
            Falls kein Modell verfuegbar: (0.0, 0.0, 0.0)
        """
        self._ensure_loaded()

        if forecast_type not in self._models:
            return 0.0, 0.0, 0.0

        try:
            feature_names = FEATURE_SETS.get(forecast_type, [])
            X = [[features.get(f, 0.0) for f in feature_names]]

            correction = float(self._models[forecast_type].predict(X)[0])

            # Konfidenzintervalle
            lower = correction
            upper = correction
            if forecast_type in self._lower_models:
                lower = float(self._lower_models[forecast_type].predict(X)[0])
            if forecast_type in self._upper_models:
                upper = float(self._upper_models[forecast_type].predict(X)[0])

            return correction, lower, upper

        except Exception as e:
            logger.warning("ML-Prediction fehlgeschlagen fuer %s: %s", forecast_type, e)
            return 0.0, 0.0, 0.0

    @property
    def loaded_models(self) -> list[str]:
        """Liste der geladenen Modell-Typen."""
        self._ensure_loaded()
        return list(self._models.keys())


# Singleton
ml_predictor = MLPredictor()
