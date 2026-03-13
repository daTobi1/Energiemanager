"""
Trend-API: Zeitreihen-Abfrage, Aggregation und Statistiken aus der Measurements-Tabelle.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_settings
from app.core.database import get_db

router = APIRouter()

_is_sqlite = app_settings.database_url.startswith("sqlite")


def _bucket_expr(interval: str) -> str | None:
    """SQL-Ausdruck für Zeitaggregation je nach DB-Backend."""
    minutes_map = {"1min": 1, "5min": 5, "15min": 15, "1h": 60, "1d": 1440}
    minutes = minutes_map.get(interval)
    if minutes is None:
        return None  # raw

    seconds = minutes * 60

    if _is_sqlite:
        # Epoch-basiertes Rounding — vermeidet Probleme mit SQLAlchemy Bind-Parameter-Erkennung
        return (
            f"strftime('%Y-%m-%dT%H:%M:%S', "
            f"(CAST(strftime('%s', timestamp) AS INTEGER) / {seconds}) * {seconds}, "
            f"'unixepoch')"
        )
    else:
        # TimescaleDB / PostgreSQL
        return f"time_bucket('{minutes} minutes', timestamp)::text"


@router.get("/time-range")
async def get_trend_time_range(db: AsyncSession = Depends(get_db)):
    """Liefert den tatsaechlichen Zeitbereich der vorhandenen Messdaten."""
    result = await db.execute(
        text("SELECT MIN(timestamp), MAX(timestamp), COUNT(*) FROM measurements")
    )
    row = result.fetchone()
    if row and row[2] > 0:
        min_ts = row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0])
        max_ts = row[1].isoformat() if hasattr(row[1], 'isoformat') else str(row[1])
        return {"min": min_ts, "max": max_ts, "count": row[2]}
    return {"min": None, "max": None, "count": 0}


@router.get("/sources")
async def get_trend_sources(db: AsyncSession = Depends(get_db)):
    """Liefert alle verfügbaren source.metric Kombinationen."""
    result = await db.execute(
        text("SELECT DISTINCT source, metric, unit FROM measurements ORDER BY source, metric")
    )
    return [{"source": row[0], "metric": row[1], "unit": row[2]} for row in result.fetchall()]


@router.get("/data")
async def get_trend_data(
    sources: str = Query(..., description="Komma-getrennte source.metric Paare"),
    from_ts: str = Query(..., alias="from", description="ISO Start-Zeitstempel"),
    to_ts: str = Query(..., alias="to", description="ISO End-Zeitstempel"),
    interval: str = Query("5min", description="raw|1min|5min|15min|1h|1d"),
    db: AsyncSession = Depends(get_db),
):
    """Zeitreihen-Daten mit optionaler Aggregation."""
    # Parse source.metric Paare
    pairs = []
    for s in sources.split(","):
        s = s.strip()
        parts = s.split(".", 1)
        if len(parts) != 2:
            raise HTTPException(400, f"Ungültiges Format: '{s}' — erwartet 'source.metric'")
        pairs.append((parts[0], parts[1]))

    try:
        dt_from = datetime.fromisoformat(from_ts)
        dt_to = datetime.fromisoformat(to_ts)
    except ValueError:
        raise HTTPException(400, "Ungültiges Datumsformat — ISO 8601 erwartet")

    bucket = _bucket_expr(interval)
    result_data = {}

    for source, metric in pairs:
        key = f"{source}.{metric}"

        if bucket is None:
            # Raw data
            query = text(
                "SELECT timestamp, value, unit FROM measurements "
                "WHERE source = :source AND metric = :metric "
                "AND timestamp >= :from_ts AND timestamp <= :to_ts "
                "ORDER BY timestamp"
            )
            result = await db.execute(query, {
                "source": source, "metric": metric,
                "from_ts": dt_from, "to_ts": dt_to,
            })
            rows = result.fetchall()
            unit = rows[0][2] if rows else ""
            result_data[key] = {
                "unit": unit,
                "timestamps": [row[0].isoformat() if hasattr(row[0], 'isoformat') else str(row[0]) for row in rows],
                "values": [row[1] for row in rows],
                "min": [row[1] for row in rows],
                "max": [row[1] for row in rows],
            }
        else:
            # Aggregated data
            query = text(
                f"SELECT {bucket} AS bucket, "
                "AVG(value) AS avg_val, MIN(value) AS min_val, MAX(value) AS max_val, "
                "MIN(unit) AS unit "
                "FROM measurements "
                "WHERE source = :source AND metric = :metric "
                "AND timestamp >= :from_ts AND timestamp <= :to_ts "
                "GROUP BY bucket ORDER BY bucket"
            )
            result = await db.execute(query, {
                "source": source, "metric": metric,
                "from_ts": dt_from, "to_ts": dt_to,
            })
            rows = result.fetchall()
            unit = rows[0][4] if rows else ""
            result_data[key] = {
                "unit": unit,
                "timestamps": [row[0] for row in rows],
                "values": [round(row[1], 3) for row in rows],
                "min": [round(row[2], 3) for row in rows],
                "max": [round(row[3], 3) for row in rows],
            }

    return result_data


@router.get("/statistics")
async def get_trend_statistics(
    sources: str = Query(..., description="Komma-getrennte source.metric Paare"),
    from_ts: str = Query(..., alias="from", description="ISO Start-Zeitstempel"),
    to_ts: str = Query(..., alias="to", description="ISO End-Zeitstempel"),
    db: AsyncSession = Depends(get_db),
):
    """Statistiken (min, max, avg, sum, count) für einen Zeitraum."""
    pairs = []
    for s in sources.split(","):
        s = s.strip()
        parts = s.split(".", 1)
        if len(parts) != 2:
            raise HTTPException(400, f"Ungültiges Format: '{s}' — erwartet 'source.metric'")
        pairs.append((parts[0], parts[1]))

    try:
        dt_from = datetime.fromisoformat(from_ts)
        dt_to = datetime.fromisoformat(to_ts)
    except ValueError:
        raise HTTPException(400, "Ungültiges Datumsformat — ISO 8601 erwartet")

    result_data = {}
    for source, metric in pairs:
        key = f"{source}.{metric}"
        query = text(
            "SELECT MIN(value), MAX(value), AVG(value), SUM(value), COUNT(*) "
            "FROM measurements "
            "WHERE source = :source AND metric = :metric "
            "AND timestamp >= :from_ts AND timestamp <= :to_ts"
        )
        result = await db.execute(query, {
            "source": source, "metric": metric,
            "from_ts": dt_from, "to_ts": dt_to,
        })
        row = result.fetchone()
        if row and row[4] > 0:
            result_data[key] = {
                "min": round(row[0], 3),
                "max": round(row[1], 3),
                "avg": round(row[2], 3),
                "sum": round(row[3], 3),
                "count": row[4],
            }
        else:
            result_data[key] = {"min": 0, "max": 0, "avg": 0, "sum": 0, "count": 0}

    return result_data
