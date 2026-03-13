"""
Scheduler-Endpoints.

GET  /scheduler/status   — Aktueller Scheduler-Status
POST /scheduler/start    — Scheduler starten
POST /scheduler/stop     — Scheduler stoppen
POST /scheduler/trigger  — Manuell Optimierung ausloesen
"""

from fastapi import APIRouter, Query

from app.services.scheduler import scheduler

router = APIRouter()


@router.get("/status")
async def get_scheduler_status():
    """Aktueller Scheduler-Status mit Statistiken."""
    return scheduler.status


@router.post("/start")
async def start_scheduler(
    optimization_interval: int = Query(
        900, ge=60, le=3600,
        description="Optimierungs-Intervall in Sekunden (60-3600, Standard: 900=15min)",
    ),
    auto_mode: bool = Query(
        True,
        description="Controller automatisch auf auto-Modus setzen",
    ),
):
    """Scheduler starten — periodische Optimierung und Fahrplan-Ausfuehrung."""
    if scheduler.running:
        return {"status": "already_running"}

    await scheduler.start(
        optimization_interval=optimization_interval,
        auto_mode=auto_mode,
    )
    return {
        "status": "started",
        "optimization_interval_s": optimization_interval,
        "auto_mode": auto_mode,
    }


@router.post("/stop")
async def stop_scheduler():
    """Scheduler stoppen."""
    await scheduler.stop()
    return {"status": "stopped"}


@router.post("/trigger")
async def trigger_optimization(
    hours: int = Query(24, ge=1, le=72),
    solver: str = Query("auto", pattern="^(auto|milp|heuristic)$"),
):
    """Manuell eine Optimierung ausloesen (unabhaengig vom Scheduler-Status)."""
    result = await scheduler.trigger_optimization(hours=hours, solver=solver)
    return result
