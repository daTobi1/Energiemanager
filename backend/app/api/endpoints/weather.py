"""
Wetter- und Prognose-Endpoints.

GET /weather/current           — Aktuelle Wetterdaten
GET /weather/forecast          — Stundenvorhersage (bis 7 Tage)
GET /weather/pv-forecast       — PV-Ertragsprognose
GET /weather/load-forecast     — Last-Prognose
GET /weather/thermal-forecast  — Thermische Prognose (Heizlast, WP, Speicher)
GET /weather/pv-accuracy       — Prognose vs. Ist-Vergleich
POST /weather/refresh          — Cache invalidieren + neu laden
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.config import SystemSettingsConfig
from app.models.weather import WeatherCache
from app.services.load_forecast import load_forecast_service
from app.services.pv_forecast import pv_forecast_service
from app.services.thermal_forecast import thermal_forecast_service
from app.services.weather import weather_service

router = APIRouter()


async def _get_location(db: AsyncSession) -> tuple[float, float]:
    """Standort aus SystemSettings laden."""
    from sqlalchemy import select
    result = await db.execute(select(SystemSettingsConfig))
    row = result.scalar_one_or_none()
    if row and row.data:
        return row.data.get("latitude", 48.1), row.data.get("longitude", 11.6)
    return 48.1, 11.6


@router.get("/current")
async def get_current_weather(db: AsyncSession = Depends(get_db)):
    """Aktuelle Wetterdaten vom Standort."""
    lat, lon = await _get_location(db)
    data = await weather_service.get_current_and_forecast(lat, lon, forecast_days=1)
    if not data or "current" not in data:
        return {"error": "Keine Wetterdaten verfuegbar", "data": None}

    current = data["current"]
    return {
        "temperature_c": current.get("temperature_2m"),
        "humidity_pct": current.get("relative_humidity_2m"),
        "wind_speed_ms": current.get("wind_speed_10m"),
        "cloud_cover_pct": current.get("cloud_cover"),
        "precipitation_mm": current.get("precipitation"),
        "weather_code": current.get("weather_code"),
        "ghi_wm2": current.get("shortwave_radiation"),
        "updated_at": data.get("current", {}).get("time", ""),
    }


@router.get("/forecast")
async def get_weather_forecast(
    hours: int = Query(72, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    """Stundenweise Wettervorhersage."""
    lat, lon = await _get_location(db)
    forecast_days = max(1, min(7, (hours + 23) // 24))
    data = await weather_service.get_current_and_forecast(lat, lon, forecast_days)

    if not data or "hourly" not in data:
        return {"error": "Keine Wetterdaten verfuegbar", "hourly": []}

    hourly_raw = data["hourly"]
    times = hourly_raw.get("time", [])

    hourly = []
    for i, t in enumerate(times):
        if i >= hours:
            break
        hourly.append({
            "time": t,
            "temperature_c": hourly_raw.get("temperature_2m", [])[i] if i < len(hourly_raw.get("temperature_2m", [])) else None,
            "humidity_pct": hourly_raw.get("relative_humidity_2m", [])[i] if i < len(hourly_raw.get("relative_humidity_2m", [])) else None,
            "wind_speed_ms": hourly_raw.get("wind_speed_10m", [])[i] if i < len(hourly_raw.get("wind_speed_10m", [])) else None,
            "wind_direction_deg": hourly_raw.get("wind_direction_10m", [])[i] if i < len(hourly_raw.get("wind_direction_10m", [])) else None,
            "cloud_cover_pct": hourly_raw.get("cloud_cover", [])[i] if i < len(hourly_raw.get("cloud_cover", [])) else None,
            "precipitation_mm": hourly_raw.get("precipitation", [])[i] if i < len(hourly_raw.get("precipitation", [])) else None,
            "weather_code": hourly_raw.get("weather_code", [])[i] if i < len(hourly_raw.get("weather_code", [])) else None,
            "ghi_wm2": hourly_raw.get("shortwave_radiation", [])[i] if i < len(hourly_raw.get("shortwave_radiation", [])) else None,
            "dni_wm2": hourly_raw.get("direct_normal_irradiance", [])[i] if i < len(hourly_raw.get("direct_normal_irradiance", [])) else None,
            "dhi_wm2": hourly_raw.get("diffuse_radiation", [])[i] if i < len(hourly_raw.get("diffuse_radiation", [])) else None,
        })

    return {
        "location": {
            "lat": data.get("latitude"),
            "lon": data.get("longitude"),
            "altitude": data.get("elevation"),
        },
        "generated_at": data.get("current", {}).get("time", ""),
        "hourly": hourly,
    }


@router.get("/pv-forecast")
async def get_pv_forecast(hours: int = Query(72, ge=1, le=168)):
    """PV-Ertragsprognose basierend auf Wetterdaten + Anlagenparametern."""
    return await pv_forecast_service.get_forecast(hours)


@router.get("/load-forecast")
async def get_load_forecast(hours: int = Query(72, ge=1, le=168)):
    """Last-Prognose basierend auf Profil + Wetter + historischen Mustern."""
    return await load_forecast_service.get_forecast(hours)


@router.get("/thermal-forecast")
async def get_thermal_forecast(hours: int = Query(72, ge=1, le=168)):
    """Thermische Prognose: Heizlast, WP-Betrieb, Speichertemperatur."""
    return await thermal_forecast_service.get_forecast(hours)


@router.get("/pv-accuracy")
async def get_pv_accuracy(
    from_ts: str = Query(..., alias="from"),
    to_ts: str = Query(..., alias="to"),
):
    """Vergleicht PV-Prognose mit tatsaechlichen Messwerten."""
    return await pv_forecast_service.get_accuracy(from_ts, to_ts)


@router.post("/refresh")
async def refresh_weather_cache(db: AsyncSession = Depends(get_db)):
    """Cache loeschen und Wetterdaten neu laden."""
    await db.execute(delete(WeatherCache))
    await db.commit()

    lat, lon = await _get_location(db)
    data = await weather_service.get_current_and_forecast(lat, lon, forecast_days=3)
    forecast = await pv_forecast_service.get_forecast(72)

    return {
        "status": "ok",
        "weather_available": data is not None,
        "pv_forecast_hours": len(forecast.get("hourly", [])),
    }
