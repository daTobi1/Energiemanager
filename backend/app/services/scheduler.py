"""
Scheduler — Periodische Optimierung, Fahrplan-Ausfuehrung und ML-Retraining.

Kernaufgaben:
1. Optimierer aufrufen (Fahrplan erstellen)
2. Fahrplan an Controller uebergeben
3. Aktuelle Stellgroessen an Lambda Bridge weiterleiten (falls verbunden)
4. ML-Modelle periodisch nachtrainieren

Zyklen:
- Optimierung: alle 15 Minuten (konfigurierbar)
- Lambda-Sync: alle 60 Sekunden (aktuelle Stellgroessen anwenden)
- ML-Retrain: alle 24 Stunden
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.services.controller import controller
from app.services.optimizer import energy_optimizer

logger = logging.getLogger(__name__)

# Defaults (Sekunden)
OPTIMIZATION_INTERVAL = 15 * 60   # 15 Minuten
LAMBDA_SYNC_INTERVAL = 60         # 1 Minute
ML_RETRAIN_INTERVAL = 24 * 3600   # 24 Stunden


@dataclass
class SchedulerStats:
    """Laufzeit-Statistiken des Schedulers."""
    optimization_runs: int = 0
    optimization_errors: int = 0
    lambda_syncs: int = 0
    ml_retrains: int = 0
    last_optimization_at: str | None = None
    last_optimization_duration_ms: float = 0
    last_schedule_hours: int = 0
    last_schedule_solver: str = ""
    last_schedule_strategy: str = ""
    last_error: str | None = None
    last_error_at: str | None = None


class Scheduler:
    """Autonomer Scheduler: Optimierung → Controller → Hardware."""

    def __init__(self):
        self._running = False
        self._optimization_interval = OPTIMIZATION_INTERVAL
        self._lambda_sync_interval = LAMBDA_SYNC_INTERVAL
        self._ml_retrain_interval = ML_RETRAIN_INTERVAL
        self._stats = SchedulerStats()
        self._tasks: list[asyncio.Task] = []

    @property
    def running(self) -> bool:
        return self._running

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "intervals": {
                "optimization_s": self._optimization_interval,
                "lambda_sync_s": self._lambda_sync_interval,
                "ml_retrain_s": self._ml_retrain_interval,
            },
            "controller_mode": controller.mode,
            "stats": {
                "optimization_runs": self._stats.optimization_runs,
                "optimization_errors": self._stats.optimization_errors,
                "lambda_syncs": self._stats.lambda_syncs,
                "ml_retrains": self._stats.ml_retrains,
                "last_optimization_at": self._stats.last_optimization_at,
                "last_optimization_duration_ms": self._stats.last_optimization_duration_ms,
                "last_schedule_hours": self._stats.last_schedule_hours,
                "last_schedule_solver": self._stats.last_schedule_solver,
                "last_schedule_strategy": self._stats.last_schedule_strategy,
                "last_error": self._stats.last_error,
                "last_error_at": self._stats.last_error_at,
            },
        }

    async def start(
        self,
        optimization_interval: int | None = None,
        auto_mode: bool = True,
    ):
        """Scheduler starten. Setzt Controller optional auf auto."""
        if self._running:
            return

        if optimization_interval is not None:
            self._optimization_interval = max(60, optimization_interval)

        self._running = True

        # Controller auf auto setzen, damit Fahrplan ausgefuehrt wird
        if auto_mode and controller.mode != "auto":
            controller.set_mode("auto")
            logger.info("Controller auf auto-Modus gesetzt")

        # Sofort erste Optimierung durchfuehren
        try:
            await self._run_optimization()
        except Exception:
            logger.exception("Fehler bei initialer Optimierung")

        # Periodische Tasks starten
        self._tasks = [
            asyncio.create_task(self._optimization_loop()),
            asyncio.create_task(self._lambda_sync_loop()),
            asyncio.create_task(self._ml_retrain_loop()),
        ]

        logger.info(
            "Scheduler gestartet (Optimierung alle %ds, Lambda-Sync alle %ds)",
            self._optimization_interval,
            self._lambda_sync_interval,
        )

    async def stop(self):
        """Scheduler stoppen."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()
        logger.info("Scheduler gestoppt")

    async def trigger_optimization(self, hours: int = 24, solver: str = "auto") -> dict:
        """Manuell eine Optimierung ausloesen (auch wenn Scheduler nicht laeuft)."""
        return await self._run_optimization(hours=hours, solver=solver)

    # ── Periodische Loops ─────────────────────────────────────────────

    async def _optimization_loop(self):
        """Periodisch neuen Fahrplan erstellen und an Controller uebergeben."""
        try:
            while self._running:
                await asyncio.sleep(self._optimization_interval)
                if not self._running:
                    break
                try:
                    await self._run_optimization()
                except Exception:
                    logger.exception("Fehler im Optimierungs-Zyklus")
        except asyncio.CancelledError:
            pass

    async def _lambda_sync_loop(self):
        """Periodisch aktuelle Controller-Stellgroessen an Lambda Bridge senden."""
        try:
            while self._running:
                await asyncio.sleep(self._lambda_sync_interval)
                if not self._running:
                    break
                try:
                    await self._sync_lambda_bridge()
                except Exception:
                    logger.exception("Fehler beim Lambda-Sync")
        except asyncio.CancelledError:
            pass

    async def _ml_retrain_loop(self):
        """ML-Modelle periodisch nachtrainieren."""
        try:
            while self._running:
                await asyncio.sleep(self._ml_retrain_interval)
                if not self._running:
                    break
                try:
                    await self._run_ml_retrain()
                except Exception:
                    logger.exception("Fehler beim ML-Retrain")
        except asyncio.CancelledError:
            pass

    # ── Kernlogik ─────────────────────────────────────────────────────

    async def _run_optimization(self, hours: int = 24, solver: str = "auto") -> dict:
        """
        Einen Optimierungszyklus durchfuehren:
        1. Optimierer erstellt Fahrplan (mit echten Prognosen)
        2. Fahrplan wird an Controller uebergeben
        3. Statistiken werden aktualisiert
        """
        t0 = asyncio.get_event_loop().time()
        now_str = datetime.now(timezone.utc).isoformat()

        logger.info("Optimierung gestartet (%dh, solver=%s)", hours, solver)

        try:
            schedule = await energy_optimizer.create_schedule(hours, solver=solver)
        except Exception as e:
            self._stats.optimization_errors += 1
            self._stats.last_error = str(e)
            self._stats.last_error_at = now_str
            logger.error("Optimierung fehlgeschlagen: %s", e)
            raise

        # Pruefen ob Ergebnis gueltig ist
        if "error" in schedule:
            self._stats.optimization_errors += 1
            self._stats.last_error = schedule["error"]
            self._stats.last_error_at = now_str
            logger.warning("Optimierung ergab Fehler: %s", schedule["error"])
            return schedule

        # Fahrplan an Controller uebergeben
        controller.update_schedule(schedule)

        # Statistiken aktualisieren
        duration_ms = (asyncio.get_event_loop().time() - t0) * 1000
        self._stats.optimization_runs += 1
        self._stats.last_optimization_at = now_str
        self._stats.last_optimization_duration_ms = round(duration_ms, 1)
        self._stats.last_schedule_hours = schedule.get("hours", 0)
        self._stats.last_schedule_solver = schedule.get("solver", "unknown")
        self._stats.last_schedule_strategy = schedule.get("strategy", "")

        summary = schedule.get("summary", {})
        logger.info(
            "Optimierung abgeschlossen in %.0fms: %dh %s, "
            "Kosten=%.1fct, CO2=%.2fkg, Eigenverbrauch=%.0f%%, Solver=%s",
            duration_ms,
            schedule.get("hours", 0),
            schedule.get("strategy", ""),
            summary.get("net_cost_ct", 0),
            summary.get("total_co2_kg", 0),
            summary.get("avg_self_consumption_pct", 0),
            schedule.get("solver", "?"),
        )

        return schedule

    async def _sync_lambda_bridge(self):
        """
        Aktuelle Controller-Stellgroessen an Lambda Bridge senden.

        Wird nur ausgefuehrt wenn:
        - Controller im auto- oder manual-Modus ist
        - Lambda Bridge verbunden ist
        """
        from app.services.lambda_bridge import lambda_bridge

        # Pruefen ob Lambda verbunden
        bridge_status = lambda_bridge.status
        if not bridge_status.get("connected"):
            return

        # Pruefen ob Controller aktiv
        if controller.mode == "off":
            return

        setpoints = controller.setpoints
        if setpoints.source in ("off", "heuristic"):
            return

        # Stellgroessen an Lambda Bridge senden
        result = await lambda_bridge.apply_setpoints(setpoints)
        self._stats.lambda_syncs += 1

        if result.get("error"):
            logger.warning("Lambda-Sync Fehler: %s", result["error"])
        else:
            logger.debug(
                "Lambda-Sync: flow=%.1f°C, surplus=%dW",
                setpoints.flow_temp_c,
                int(setpoints.hp_thermal_kw * 1000),
            )

    async def _run_ml_retrain(self):
        """ML-Korrekturmodelle neu trainieren."""
        from app.services.ml.trainer import ml_trainer

        logger.info("ML-Retrain gestartet")
        results = await ml_trainer.train_all(days_back=90)
        self._stats.ml_retrains += 1

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
                logger.info(
                    "ML-Retrain %s: %s",
                    forecast_type,
                    result.get("error", "Fehlgeschlagen"),
                )


# Singleton
scheduler = Scheduler()
