"""Modell-Versionierung und -Verwaltung."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class ModelStore:
    """Verwaltet ML-Modell-Versionen und Metadaten."""

    def __init__(self, model_dir: str | None = None):
        self.model_dir = Path(model_dir or settings.ml_model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_path = self.model_dir / "metadata.json"
        self._metadata = self._load_metadata()

    def _load_metadata(self) -> dict:
        if self.metadata_path.exists():
            return json.loads(self.metadata_path.read_text())
        return {"models": {}}

    def _save_metadata(self) -> None:
        self.metadata_path.write_text(json.dumps(self._metadata, indent=2, default=str))

    def register_model(
        self, forecast_type: str, version: str, metrics: dict, training_samples: int
    ) -> None:
        """Registriere ein neues Modell."""
        self._metadata["models"][forecast_type] = {
            "version": version,
            "metrics": metrics,
            "training_samples": training_samples,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }
        self._save_metadata()
        logger.info("Registered model %s version %s", forecast_type, version)

    def get_active_version(self, forecast_type: str) -> str:
        """Hole die aktive Modell-Version."""
        model_info = self._metadata["models"].get(forecast_type)
        if model_info:
            return model_info["version"]
        return "rule_based_v1"

    def should_retrain(self, forecast_type: str, min_hours: int = 168) -> bool:
        """Prüfe ob ein Retraining nötig ist."""
        model_info = self._metadata["models"].get(forecast_type)
        if not model_info:
            return True

        trained_at = datetime.fromisoformat(model_info["trained_at"])
        hours_since = (datetime.now(timezone.utc) - trained_at).total_seconds() / 3600
        return hours_since >= min_hours
