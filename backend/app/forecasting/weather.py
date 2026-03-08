"""Wetter-API Anbindung für Prognosen."""

import logging
from dataclasses import dataclass
from datetime import datetime

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class WeatherData:
    timestamp: datetime
    temperature_c: float
    cloud_cover_pct: float
    ghi_w_per_m2: float  # Global Horizontal Irradiance
    wind_speed_m_s: float
    humidity_pct: float


class WeatherService:
    """Holt Wetterdaten und -prognosen von der API."""

    def __init__(self):
        self.api_key = settings.weather_api_key
        self.lat = settings.latitude
        self.lon = settings.longitude

    async def get_forecast(self, hours: int = 48) -> list[WeatherData]:
        """Hole Wetterprognose für die nächsten `hours` Stunden."""
        if not self.api_key:
            logger.warning("No weather API key configured, using dummy data")
            return self._generate_dummy_data(hours)

        url = (
            f"https://api.openweathermap.org/data/3.0/onecall"
            f"?lat={self.lat}&lon={self.lon}"
            f"&exclude=minutely,alerts"
            f"&appid={self.api_key}&units=metric"
        )

        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        return [
            WeatherData(
                timestamp=datetime.fromtimestamp(h["dt"]),
                temperature_c=h["temp"],
                cloud_cover_pct=h["clouds"],
                ghi_w_per_m2=h.get("uvi", 0) * 100,  # Vereinfachte Umrechnung
                wind_speed_m_s=h["wind_speed"],
                humidity_pct=h["humidity"],
            )
            for h in data.get("hourly", [])[:hours]
        ]

    def _generate_dummy_data(self, hours: int) -> list[WeatherData]:
        """Dummy-Daten für Entwicklung ohne API-Key."""
        from datetime import timedelta, timezone
        import math

        now = datetime.now(timezone.utc)
        data = []
        for i in range(hours):
            t = now + timedelta(hours=i)
            hour = t.hour
            # Simuliere Tagesverlauf
            ghi = max(0, 800 * math.sin(math.pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0.0
            data.append(
                WeatherData(
                    timestamp=t,
                    temperature_c=10 + 8 * math.sin(math.pi * (hour - 6) / 12),
                    cloud_cover_pct=30.0,
                    ghi_w_per_m2=ghi,
                    wind_speed_m_s=3.0,
                    humidity_pct=60.0,
                )
            )
        return data
