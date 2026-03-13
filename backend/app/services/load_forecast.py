"""
Last-Prognose-Service — Berechnet erwarteten Stromverbrauch.

Verwendet:
- VDI 4655 Standardlastprofil (Haushalt-Tageskurve)
- Temperaturabhaengigkeit (Heizbedarf steigt bei Kaelte)
- Wochentag-Korrektur (Wochenende = hoeherer Verbrauch)
- Historische Muster aus Messdaten (gleitender Durchschnitt)

Spaeter erweiterbar durch ML (Phase 3).
"""

import logging
import math
from datetime import datetime, timezone

from sqlalchemy import select, text

from app.core.database import async_session
from app.models.config import ConsumerConfig, SystemSettingsConfig
from app.services.weather import weather_service

logger = logging.getLogger(__name__)

# VDI 4655 Tagesprofil-Faktoren (normalisiert auf ~1.0)
LOAD_PROFILE_WEEKDAY = [
    0.40, 0.30, 0.30, 0.30, 0.35, 0.50,  # 0-5 Uhr
    0.70, 1.20, 1.40, 1.10, 0.90, 0.85,   # 6-11 Uhr
    1.30, 1.10, 0.90, 0.85, 0.90, 1.30,   # 12-17 Uhr
    1.80, 2.00, 1.70, 1.30, 0.80, 0.50,   # 18-23 Uhr
]

LOAD_PROFILE_WEEKEND = [
    0.45, 0.35, 0.30, 0.30, 0.30, 0.40,   # 0-5 Uhr
    0.55, 0.80, 1.20, 1.40, 1.30, 1.20,   # 6-11 Uhr (spaeter aufstehen)
    1.40, 1.20, 1.10, 1.00, 1.00, 1.30,   # 12-17 Uhr
    1.70, 1.90, 1.80, 1.50, 1.00, 0.60,   # 18-23 Uhr
]


def _get_profile_factor(hour: float, weekday: int) -> float:
    """Interpolierter Lastprofil-Faktor fuer eine Stunde."""
    profile = LOAD_PROFILE_WEEKEND if weekday >= 5 else LOAD_PROFILE_WEEKDAY
    h_idx = int(hour) % 24
    frac = hour - int(hour)
    next_idx = (h_idx + 1) % 24
    return profile[h_idx] * (1 - frac) + profile[next_idx] * frac


def _temperature_factor(outdoor_temp_c: float) -> float:
    """
    Temperaturabhaengiger Korrekturfaktor.
    - Unter 15°C: Mehr Verbrauch (Heizungsunterstuetzung, Licht)
    - Ueber 25°C: Leicht mehr (Kuehlung, Ventilatoren)
    - 15-25°C: Neutral (~1.0)
    """
    if outdoor_temp_c < 15:
        return 1.0 + (15 - outdoor_temp_c) * 0.015  # +1.5% pro Grad unter 15
    elif outdoor_temp_c > 25:
        return 1.0 + (outdoor_temp_c - 25) * 0.01   # +1% pro Grad ueber 25
    return 1.0


class LoadForecastService:
    """Berechnet Last-Prognose basierend auf Profil + Wetter + Historie."""

    async def _load_annual_consumption(self) -> float:
        """Gesamter Jahresverbrauch aus Consumer-Konfiguration."""
        async with async_session() as db:
            result = await db.execute(select(ConsumerConfig))
            consumers = [r.data for r in result.scalars()]
        total = sum(c.get("annualConsumptionKwh", 3000) for c in consumers)
        return total if total > 0 else 5000  # Fallback

    async def _load_location(self) -> tuple[float, float]:
        async with async_session() as db:
            result = await db.execute(select(SystemSettingsConfig))
            row = result.scalar_one_or_none()
        if row and row.data:
            return row.data.get("latitude", 48.1), row.data.get("longitude", 11.6)
        return 48.1, 11.6

    async def _get_historical_avg(self, hour: int, weekday: int) -> float | None:
        """
        Gleitender Durchschnitt der tatsaechlichen Last fuer diese Stunde/Wochentag.
        Nutzt die letzten 4 Wochen an Messdaten.
        """
        try:
            async with async_session() as db:
                # SQLite: strftime('%w', timestamp) = weekday (0=Sonntag)
                # Wir konvertieren: Python weekday 0=Montag -> SQLite '%w' 1=Montag
                sqlite_weekday = (weekday + 1) % 7  # Python 0=Mo -> SQLite 1=Mo
                sql = text("""
                    SELECT AVG(value)
                    FROM measurements
                    WHERE source = 'load' AND metric = 'power_kw'
                        AND CAST(strftime('%H', timestamp) AS INTEGER) = :hour
                        AND CAST(strftime('%w', timestamp) AS INTEGER) = :weekday
                        AND timestamp >= datetime('now', '-28 days')
                """)
                result = await db.execute(sql, {"hour": hour, "weekday": sqlite_weekday})
                row = result.fetchone()
                if row and row[0] is not None:
                    return float(row[0])
        except Exception as e:
            logger.debug("Historische Last nicht verfuegbar: %s", e)
        return None

    async def get_forecast(self, hours: int = 72) -> dict:
        """
        Last-Prognose fuer die naechsten Stunden.

        Returns: {
            generated_at, annual_consumption_kwh,
            hourly: [{time, power_kw, temperature_c, profile_factor}],
            daily_summary: {day: total_kwh}
        }
        """
        annual_kwh = await self._load_annual_consumption()
        avg_kw = annual_kwh / 8760  # Durchschnittliche Stundenleistung

        lat, lon = await self._load_location()
        forecast_days = max(1, min(7, (hours + 23) // 24))
        weather = await weather_service.get_current_and_forecast(lat, lon, forecast_days)

        temps_by_hour: dict[str, float] = {}
        if weather and "hourly" in weather:
            times = weather["hourly"].get("time", [])
            temps = weather["hourly"].get("temperature_2m", [])
            for i, t in enumerate(times):
                if i < len(temps):
                    temps_by_hour[t] = temps[i]

        result_hourly = []
        daily_energy: dict[str, float] = {}
        now = datetime.now(timezone.utc)

        for h in range(hours):
            dt = datetime(now.year, now.month, now.day, now.hour, 0, 0, tzinfo=timezone.utc)
            from datetime import timedelta
            dt = dt + timedelta(hours=h)

            hour_float = dt.hour + dt.minute / 60.0
            weekday = dt.weekday()
            time_str = dt.strftime("%Y-%m-%dT%H:00")

            # Base profile factor
            profile_factor = _get_profile_factor(hour_float, weekday)

            # Temperature from weather forecast
            temp_c = temps_by_hour.get(time_str, 10.0)
            temp_fact = _temperature_factor(temp_c)

            # Try historical average
            hist_avg = await self._get_historical_avg(dt.hour, weekday)

            if hist_avg is not None and hist_avg > 0:
                # Blend: 70% historical, 30% profile model
                model_kw = avg_kw * profile_factor * temp_fact
                power_kw = 0.7 * hist_avg + 0.3 * model_kw
            else:
                power_kw = avg_kw * profile_factor * temp_fact

            result_hourly.append({
                "time": time_str,
                "power_kw": round(power_kw, 2),
                "temperature_c": round(temp_c, 1),
                "profile_factor": round(profile_factor, 2),
            })

            day_key = time_str[:10]
            daily_energy[day_key] = daily_energy.get(day_key, 0) + power_kw

        daily_summary = {day: round(kwh, 1) for day, kwh in daily_energy.items()}

        return {
            "generated_at": now.isoformat(),
            "annual_consumption_kwh": round(annual_kwh, 0),
            "hourly": result_hourly,
            "daily_summary": daily_summary,
        }


# Singleton
load_forecast_service = LoadForecastService()
