"""Scheduler — Periodische Tasks für Prognosen und Optimierung."""

import asyncio
import logging
from datetime import datetime, timezone

from app.core.database import async_session
from app.services.optimizer import Optimizer

logger = logging.getLogger(__name__)


class Scheduler:
    """Führt periodische Optimierungs- und Prognose-Tasks aus."""

    def __init__(self):
        self.optimizer = Optimizer()
        self._running = False

    async def start(self):
        """Starte den Scheduler-Loop."""
        self._running = True
        logger.info("Scheduler started")

        while self._running:
            try:
                await self._optimization_cycle()
            except Exception:
                logger.exception("Error in optimization cycle")

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
