"""Scheduler — Periodische Tasks für Prognosen, Optimierung und ML-Retraining."""

import asyncio
import logging
from datetime import datetime, timezone

from app.core.database import async_session
from app.services.optimizer import Optimizer

logger = logging.getLogger(__name__)

# ML-Retrain alle 24h (in Scheduler-Zyklen à 60s)
ML_RETRAIN_INTERVAL_CYCLES = 24 * 60  # 1440 Zyklen = 24h


class Scheduler:
    """Führt periodische Optimierungs- und Prognose-Tasks aus."""

    def __init__(self):
        self.optimizer = Optimizer()
        self._running = False
        self._cycle_count = 0

    async def start(self):
        """Starte den Scheduler-Loop."""
        self._running = True
        logger.info("Scheduler started")

        while self._running:
            try:
                await self._optimization_cycle()
            except Exception:
                logger.exception("Error in optimization cycle")

            # ML-Retrain prüfen (alle 24h)
            self._cycle_count += 1
            if self._cycle_count >= ML_RETRAIN_INTERVAL_CYCLES:
                self._cycle_count = 0
                try:
                    await self._ml_retrain()
                except Exception:
                    logger.exception("Error in ML retrain cycle")

            await asyncio.sleep(60)  # Alle 60 Sekunden

    async def stop(self):
        self._running = False

    async def _optimization_cycle(self):
        """Führe einen Optimierungszyklus durch."""
        async with async_session() as db:
            # TODO: Echte Prognosen und Messwerte einbinden
            logger.debug(
                "Optimization cycle at %s", datetime.now(timezone.utc).isoformat()
            )

    async def _ml_retrain(self):
        """Trainiert ML-Korrektur-Modelle neu, falls genug Daten vorhanden."""
        from app.services.ml.trainer import ml_trainer

        logger.info("ML-Retrain gestartet")
        results = await ml_trainer.train_all(days_back=90)

        for forecast_type, result in results.items():
            if result.get("success"):
                logger.info(
                    "ML-Retrain %s: MAE=%.3f, R2=%.3f (%d Samples)",
                    forecast_type,
                    result["metrics"]["mae"],
                    result["metrics"]["r2"],
                    result["training_samples"],
                )
            else:
                logger.info("ML-Retrain %s: %s", forecast_type, result.get("error", "Fehlgeschlagen"))
