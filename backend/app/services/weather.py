"""
Wetter-Service — Open-Meteo-API-Anbindung mit DB-Cache.

Liefert aktuelle Wetterdaten, Vorhersage (bis 7 Tage) und historische Daten.
Open-Meteo ist kostenlos, kein API-Key noetig.
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from app.core.database import async_session
from app.models.weather import WeatherCache

logger = logging.getLogger(__name__)

OPENMETEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPENMETEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

HOURLY_VARS = (
    "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,"
    "cloud_cover,precipitation,weather_code,"
    "shortwave_radiation,direct_radiation,diffuse_radiation,direct_normal_irradiance"
)

# Cache-TTL in Sekunden
CACHE_TTL_CURRENT = 30 * 60        # 30 Minuten
CACHE_TTL_FORECAST = 2 * 60 * 60   # 2 Stunden
CACHE_TTL_HISTORICAL = 24 * 60 * 60  # 24 Stunden (aendert sich nicht mehr)


class WeatherService:
    """Fetcht und cached Wetterdaten von Open-Meteo."""

    def __init__(self):
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ------------------------------------------------------------------
    # Cache
    # ------------------------------------------------------------------

    async def _get_cached(self, cache_key: str) -> dict | None:
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(WeatherCache).where(WeatherCache.id == cache_key)
                )
                entry = result.scalar_one_or_none()
                if entry and entry.expires_at > datetime.now(timezone.utc):
                    return entry.data
                return None
        except Exception:
            return None

    async def _set_cache(self, cache_key: str, data: dict, ttl_seconds: int):
        try:
            async with async_session() as db:
                expires = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)
                existing = await db.execute(
                    select(WeatherCache).where(WeatherCache.id == cache_key)
                )
                entry = existing.scalar_one_or_none()
                if entry:
                    entry.data = data
                    entry.expires_at = expires
                else:
                    db.add(WeatherCache(id=cache_key, data=data, expires_at=expires))
                await db.commit()
        except Exception as e:
            logger.warning("Cache-Write fehlgeschlagen: %s", e)

    # ------------------------------------------------------------------
    # API-Abfragen
    # ------------------------------------------------------------------

    async def _fetch_openmeteo(self, url: str, params: dict) -> dict | None:
        try:
            client = self._get_client()
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as e:
            logger.error("Open-Meteo Fehler: %s", e)
            return None

    async def get_current_and_forecast(
        self, lat: float, lon: float, forecast_days: int = 3
    ) -> dict | None:
        """Aktuelle Wetterdaten + Vorhersage (bis 7 Tage)."""
        cache_key = f"forecast_{forecast_days}_{lat:.4f}_{lon:.4f}"

        cached = await self._get_cached(cache_key)
        if cached:
            return cached

        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": HOURLY_VARS,
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,"
                       "cloud_cover,precipitation,weather_code,shortwave_radiation",
            "forecast_days": forecast_days,
            "timezone": "auto",
        }

        data = await self._fetch_openmeteo(OPENMETEO_FORECAST_URL, params)
        if data:
            await self._set_cache(cache_key, data, CACHE_TTL_FORECAST)
        return data

    async def get_historical(
        self, lat: float, lon: float, date_from: str, date_to: str
    ) -> dict | None:
        """Historische Wetterdaten (fuer Prognose-Genauigkeitsvergleich)."""
        cache_key = f"hist_{date_from}_{date_to}_{lat:.4f}_{lon:.4f}"

        cached = await self._get_cached(cache_key)
        if cached:
            return cached

        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": HOURLY_VARS,
            "start_date": date_from,
            "end_date": date_to,
            "timezone": "auto",
        }

        data = await self._fetch_openmeteo(OPENMETEO_ARCHIVE_URL, params)
        if data:
            await self._set_cache(cache_key, data, CACHE_TTL_HISTORICAL)
        return data


# Singleton
weather_service = WeatherService()
