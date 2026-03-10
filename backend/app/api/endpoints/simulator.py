"""API-Endpoints für den Simulator."""

from fastapi import APIRouter, Query
from sqlalchemy import select, func, desc

from app.core.database import async_session
from app.models.measurement import Measurement
from app.services.simulator import simulator

router = APIRouter()


@router.get("/status")
async def get_status():
    """Aktuellen Simulator-Status abfragen."""
    return simulator.status


@router.post("/start")
async def start_simulator(
    interval: int = Query(default=5, ge=1, le=60, description="Sekunden zwischen Messungen"),
    speed: int = Query(default=1, ge=1, le=3600, description="Zeitraffer-Faktor"),
):
    """Simulator starten."""
    if simulator.is_running:
        return {"status": "already_running"}
    await simulator.start(interval=interval, speed_factor=speed)
    return {"status": "started", "interval": interval, "speed": speed}


@router.post("/stop")
async def stop_simulator():
    """Simulator stoppen."""
    await simulator.stop()
    return {"status": "stopped"}


@router.get("/measurements")
async def get_measurements(
    source: str | None = Query(default=None, description="Quelle filtern (z.B. 'pv', 'grid')"),
    metric: str | None = Query(default=None, description="Metrik filtern (z.B. 'power_kw')"),
    limit: int = Query(default=100, ge=1, le=1000),
):
    """Letzte Messwerte abfragen."""
    async with async_session() as db:
        query = select(Measurement).order_by(desc(Measurement.timestamp))
        if source:
            query = query.where(Measurement.source == source)
        if metric:
            query = query.where(Measurement.metric == metric)
        query = query.limit(limit)

        result = await db.execute(query)
        rows = result.scalars().all()
        return [
            {
                "timestamp": r.timestamp.isoformat(),
                "source": r.source,
                "metric": r.metric,
                "value": r.value,
                "unit": r.unit,
            }
            for r in rows
        ]


@router.get("/measurements/latest")
async def get_latest_measurements():
    """Aktuellste Messwerte pro Quelle+Metrik."""
    async with async_session() as db:
        # Subquery: neuester Timestamp pro (source, metric)
        subq = (
            select(
                Measurement.source,
                Measurement.metric,
                func.max(Measurement.timestamp).label("max_ts"),
            )
            .group_by(Measurement.source, Measurement.metric)
            .subquery()
        )
        query = (
            select(Measurement)
            .join(
                subq,
                (Measurement.source == subq.c.source)
                & (Measurement.metric == subq.c.metric)
                & (Measurement.timestamp == subq.c.max_ts),
            )
        )
        result = await db.execute(query)
        rows = result.scalars().all()
        # Als flaches Dict: { "pv.power_kw": 12.3, ... }
        data = {}
        for r in rows:
            data[f"{r.source}.{r.metric}"] = {
                "value": r.value,
                "unit": r.unit,
                "timestamp": r.timestamp.isoformat(),
            }
        return data


@router.delete("/measurements")
async def clear_measurements():
    """Alle Messwerte löschen."""
    async with async_session() as db:
        await db.execute(Measurement.__table__.delete())
        await db.commit()
    return {"status": "cleared"}
