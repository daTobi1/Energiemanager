"""ML-Modell Training Pipeline."""

import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

from app.config import settings
from app.ml.features import create_lag_features, create_time_features

logger = logging.getLogger(__name__)


class ModelTrainer:
    """Trainiert und verwaltet ML-Modelle für Prognosen."""

    def __init__(self, model_dir: str | None = None):
        self.model_dir = Path(model_dir or settings.ml_model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)

    def train_forecast_model(
        self,
        data: pd.DataFrame,
        target_col: str,
        forecast_type: str,
    ) -> dict:
        """Trainiere ein XGBoost-Modell für Prognosen."""
        df = data.copy()
        df = create_time_features(df)
        df = create_lag_features(df, target_col)
        df = df.dropna()

        feature_cols = [c for c in df.columns if c not in [target_col, "timestamp"]]

        # Train/Test Split (80/20, chronologisch)
        split_idx = int(len(df) * 0.8)
        X_train = df[feature_cols].iloc[:split_idx]
        y_train = df[target_col].iloc[:split_idx]
        X_test = df[feature_cols].iloc[split_idx:]
        y_test = df[target_col].iloc[split_idx:]

        model = XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
        )
        model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

        # Evaluierung
        y_pred = model.predict(X_test)
        metrics = {
            "mae": float(mean_absolute_error(y_test, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
        }

        # Modell speichern
        model_path = self.model_dir / f"{forecast_type}_xgb.joblib"
        joblib.dump({"model": model, "features": feature_cols, "metrics": metrics}, model_path)
        logger.info("Model saved to %s with MAE=%.3f", model_path, metrics["mae"])

        return metrics

    def load_model(self, forecast_type: str) -> dict | None:
        """Lade ein trainiertes Modell."""
        model_path = self.model_dir / f"{forecast_type}_xgb.joblib"
        if not model_path.exists():
            return None
        return joblib.load(model_path)

    def predict(self, forecast_type: str, features: pd.DataFrame) -> np.ndarray | None:
        """Erstelle eine Prognose mit einem trainierten Modell."""
        model_data = self.load_model(forecast_type)
        if model_data is None:
            return None

        model = model_data["model"]
        feature_cols = model_data["features"]
        available = [c for c in feature_cols if c in features.columns]

        if len(available) < len(feature_cols):
            logger.warning("Missing features: %s", set(feature_cols) - set(available))
            return None

        return model.predict(features[feature_cols])
