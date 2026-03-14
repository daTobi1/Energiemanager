"""
Scheduler — Periodische Optimierung, Fahrplan-Ausfuehrung und ML-Retraining.

Kernaufgaben:
1. Optimierer aufrufen (Fahrplan erstellen)
2. Fahrplan an Controller uebergeben
3. Aktuelle Stellgroessen an DeviceManager weiterleiten
4. ML-Modelle periodisch nachtrainieren

Zyklen:
- Optimierung: alle 15 Minuten (konfigurierbar)
- Device-Sync: alle 60 Sekunden (aktuelle Stellgroessen anwenden)
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
DEVICE_SYNC_INTERVAL = 60         # 1 Minute
ML_RETRAIN_INTERVAL = 24 * 3600   # 24 Stunden


@dataclass
class SchedulerHistoryEntry:
    """Ein Eintrag im Scheduler-Optimierungslog."""
    timestamp: str
    duration_ms: float
    hours: int
    solver: str
    strategy: str
    success: bool
    error: str | None = None
    net_cost_ct: float = 0
    total_co2_kg: float = 0
    avg_self_consumption_pct: float = 0
    peak_grid_import_kw: float = 0
    total_pv_kwh: float = 0
    total_grid_import_kwh: float = 0


MAX_HISTORY_ENTRIES = 200  # ~50h bei 15min-Intervall


@dataclass
class SchedulerStats:
    """Laufzeit-Statistiken des Schedulers."""
    optimization_runs: int = 0
    optimization_errors: int = 0
    device_syncs: int = 0
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
        self._device_sync_interval = DEVICE_SYNC_INTERVAL
        self._ml_retrain_interval = ML_RETRAIN_INTERVAL
        self._stats = SchedulerStats()
        self._history: list[SchedulerHistoryEntry] = []
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
                "device_sync_s": self._device_sync_interval,
                "ml_retrain_s": self._ml_retrain_interval,
            },
            "controller_mode": controller.mode,
            "stats": {
                "optimization_runs": self._stats.optimization_runs,
                "optimization_errors": self._stats.optimization_errors,
                "device_syncs": self._stats.device_syncs,
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

    @property
    def history(self) -> list[dict]:
        """Optimierungs-Historie als Liste von Dicts."""
        return [
            {
                "timestamp": e.timestamp,
                "duration_ms": e.duration_ms,
                "hours": e.hours,
                "solver": e.solver,
                "strategy": e.strategy,
                "success": e.success,
                "error": e.error,
                "net_cost_ct": e.net_cost_ct,
                "total_co2_kg": e.total_co2_kg,
                "avg_self_consumption_pct": e.avg_self_consumption_pct,
                "peak_grid_import_kw": e.peak_grid_import_kw,
                "total_pv_kwh": e.total_pv_kwh,
                "total_grid_import_kwh": e.total_grid_import_kwh,
            }
            for e in self._history
        ]

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

        # AlarmManager starten
        from app.services.alarm_manager import alarm_manager
        if not alarm_manager.is_running:
            await alarm_manager.start(interval=30)

        # Periodische Tasks starten
        self._tasks = [
            asyncio.create_task(self._optimization_loop()),
            asyncio.create_task(self._device_sync_loop()),
            asyncio.create_task(self._ml_retrain_loop()),
        ]

        logger.info(
            "Scheduler gestartet (Optimierung alle %ds, Device-Sync alle %ds)",
            self._optimization_interval,
            self._device_sync_interval,
        )

    async def stop(self):
        """Scheduler stoppen."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()

        from app.services.alarm_manager import alarm_manager
        if alarm_manager.is_running:
            await alarm_manager.stop()

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

    async def _device_sync_loop(self):
        """Periodisch aktuelle Controller-Stellgroessen an Geraete senden."""
        try:
            while self._running:
                await asyncio.sleep(self._device_sync_interval)
                if not self._running:
                    break
                try:
                    await self._sync_devices()
                except Exception:
                    logger.exception("Fehler beim Device-Sync")
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
            duration_ms = (asyncio.get_event_loop().time() - t0) * 1000
            self._stats.optimization_errors += 1
            self._stats.last_error = str(e)
            self._stats.last_error_at = now_str
            self._record_history(SchedulerHistoryEntry(
                timestamp=now_str, duration_ms=round(duration_ms, 1),
                hours=hours, solver=solver, strategy="",
                success=False, error=str(e),
            ))
            logger.error("Optimierung fehlgeschlagen: %s", e)
            raise

        # Pruefen ob Ergebnis gueltig ist
        if "error" in schedule:
            duration_ms = (asyncio.get_event_loop().time() - t0) * 1000
            self._stats.optimization_errors += 1
            self._stats.last_error = schedule["error"]
            self._stats.last_error_at = now_str
            self._record_history(SchedulerHistoryEntry(
                timestamp=now_str, duration_ms=round(duration_ms, 1),
                hours=hours, solver=schedule.get("solver", solver),
                strategy=schedule.get("strategy", ""),
                success=False, error=schedule["error"],
            ))
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
        self._record_history(SchedulerHistoryEntry(
            timestamp=now_str, duration_ms=round(duration_ms, 1),
            hours=schedule.get("hours", 0),
            solver=schedule.get("solver", "unknown"),
            strategy=schedule.get("strategy", ""),
            success=True,
            net_cost_ct=summary.get("net_cost_ct", 0),
            total_co2_kg=summary.get("total_co2_kg", 0),
            avg_self_consumption_pct=summary.get("avg_self_consumption_pct", 0),
            peak_grid_import_kw=summary.get("peak_grid_import_kw", 0),
            total_pv_kwh=summary.get("total_pv_kwh", 0),
            total_grid_import_kwh=summary.get("total_grid_import_kwh", 0),
        ))
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

    def _record_history(self, entry: SchedulerHistoryEntry):
        """Eintrag zur Historie hinzufuegen, aelteste Eintraege verwerfen."""
        self._history.append(entry)
        if len(self._history) > MAX_HISTORY_ENTRIES:
            self._history = self._history[-MAX_HISTORY_ENTRIES:]

    async def _sync_devices(self):
        """Aktuelle Controller-Stellgroessen an alle verbundenen Geraete senden."""
        if controller.mode == "off":
            return

        setpoints = controller.setpoints
        if setpoints.source in ("off", "heuristic"):
            return

        from app.services.device_manager import device_manager

        if device_manager.is_running and device_manager.device_count > 0:
            result = await device_manager.apply_controller_setpoints(setpoints)
            self._stats.device_syncs += 1
            if result:
                logger.debug("Device-Sync: %d Setpoints geschrieben", len(result))

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
