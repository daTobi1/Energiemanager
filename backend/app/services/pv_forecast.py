"""
PV-Prognose-Service — Berechnet erwartete PV-Erzeugung aus Wetterdaten + Anlagenparametern.

Verwendet:
- Einstrahlungsdaten (GHI, DNI, DHI) von Open-Meteo
- Anlagenparameter (Neigung, Azimut, Peakleistung, Wirkungsgrad) aus GeneratorConfig
- Isotropes Transpositionsmodell fuer geneigte Flaechen

Formel (vereinfacht):
    POA = DNI * cos(AOI) + DHI * (1+cos(tilt))/2 + GHI * albedo * (1-cos(tilt))/2
    P_kw = POA / 1000 * P_peak * eta * f_temp
"""

import logging
import math
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.database import async_session
from app.models.config import GeneratorConfig, SystemSettingsConfig
from app.services.weather import weather_service

logger = logging.getLogger(__name__)


def _solar_position(lat: float, lon: float, dt: datetime) -> tuple[float, float]:
    """
    Berechnet Sonnenhoehe (altitude) und Azimut in Grad.
    Vereinfachter Algorithmus (ausreichend fuer Stundenaufloesung).
    """
    day_of_year = dt.timetuple().tm_yday
    hour = dt.hour + dt.minute / 60.0

    # Deklination
    declination = 23.45 * math.sin(math.radians(360 / 365 * (day_of_year - 81)))

    # Stundenwinkel (15 Grad pro Stunde ab Sonnenmittag)
    # Einfache Naeherung: Sonnenmittag ~ 12:00 Lokalzeit
    # Besser: lon-basierte Korrektur
    solar_noon_offset = lon / 15.0  # Stunden
    hour_angle = 15.0 * (hour - 12.0 + solar_noon_offset)

    lat_rad = math.radians(lat)
    dec_rad = math.radians(declination)
    ha_rad = math.radians(hour_angle)

    # Sonnenhoehe
    sin_alt = (
        math.sin(lat_rad) * math.sin(dec_rad)
        + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad)
    )
    altitude = math.degrees(math.asin(max(-1, min(1, sin_alt))))

    # Azimut (0=Nord, 180=Sued)
    if math.cos(math.radians(altitude)) == 0:
        azimuth = 180.0
    else:
        cos_az = (
            math.sin(dec_rad) - math.sin(lat_rad) * math.sin(math.radians(altitude))
        ) / (math.cos(lat_rad) * math.cos(math.radians(altitude)))
        cos_az = max(-1, min(1, cos_az))
        azimuth = math.degrees(math.acos(cos_az))
        if hour_angle > 0:
            azimuth = 360 - azimuth

    return altitude, azimuth


def _transpose_irradiance(
    ghi: float, dni: float, dhi: float,
    solar_altitude: float, solar_azimuth: float,
    panel_tilt: float, panel_azimuth: float,
    albedo: float = 0.2,
) -> float:
    """
    Transponiert Einstrahlung auf geneigte Flaeche (Isotropes Modell).

    Returns: POA (Plane of Array) Einstrahlung in W/m2.
    """
    if solar_altitude <= 0:
        return 0.0

    # Einfallswinkel auf geneigte Flaeche
    tilt_rad = math.radians(panel_tilt)
    panel_az_rad = math.radians(panel_azimuth)
    solar_alt_rad = math.radians(solar_altitude)
    solar_az_rad = math.radians(solar_azimuth)

    cos_aoi = (
        math.sin(solar_alt_rad) * math.cos(tilt_rad)
        + math.cos(solar_alt_rad) * math.sin(tilt_rad)
        * math.cos(solar_az_rad - panel_az_rad)
    )
    cos_aoi = max(0, cos_aoi)

    # Isotropes Modell
    beam = dni * cos_aoi
    diffuse = dhi * (1 + math.cos(tilt_rad)) / 2
    reflected = ghi * albedo * (1 - math.cos(tilt_rad)) / 2

    return beam + diffuse + reflected


def _calculate_pv_power(
    poa_wm2: float,
    peak_kwp: float,
    efficiency: float,
    temp_coeff: float,
    ambient_temp_c: float,
) -> float:
    """
    PV-Leistung aus POA-Einstrahlung.

    temp_coeff: typisch -0.003 bis -0.005 (/K), Verlust pro K ueber 25°C
    """
    if poa_wm2 <= 0:
        return 0.0

    # Zelltemperatur (NOCT-Naeherung)
    cell_temp = ambient_temp_c + poa_wm2 / 800 * 20

    # Temperaturkorrektur
    temp_factor = 1 + temp_coeff * (cell_temp - 25)
    temp_factor = max(0.5, min(1.2, temp_factor))

    power_kw = poa_wm2 / 1000 * peak_kwp * efficiency * temp_factor
    return max(0, power_kw)


class PvForecastService:
    """Berechnet PV-Ertragsprognose aus Wetterdaten + Anlagenparametern."""

    async def _load_pv_generators(self) -> list[dict]:
        """Laedt alle PV-Generatoren aus der Datenbank."""
        async with async_session() as db:
            result = await db.execute(select(GeneratorConfig))
            all_gens = [r.data for r in result.scalars()]
        return [g for g in all_gens if g.get("type") == "pv"]

    async def _load_location(self) -> tuple[float, float, float]:
        """Laedt Standortdaten aus den Systemeinstellungen."""
        async with async_session() as db:
            result = await db.execute(select(SystemSettingsConfig))
            row = result.scalar_one_or_none()
        if row and row.data:
            return (
                row.data.get("latitude", 48.1),
                row.data.get("longitude", 11.6),
                row.data.get("altitudeM", 520),
            )
        return 48.1, 11.6, 520  # Default: Muenchen

    async def get_forecast(self, hours: int = 72) -> dict:
        """
        PV-Ertragsprognose fuer die naechsten Stunden.

        Returns: {
            generated_at, total_peak_kwp,
            panels: [{id, name, peak_kwp, tilt, azimuth}],
            hourly: [{time, power_kw, ghi_wm2, temperature_c}],
            daily_summary: {today_kwh, tomorrow_kwh, ...}
        }
        """
        lat, lon, _alt = await self._load_location()
        pv_gens = await self._load_pv_generators()

        if not pv_gens:
            return {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_peak_kwp": 0,
                "panels": [],
                "hourly": [],
                "daily_summary": {},
            }

        forecast_days = max(1, min(7, (hours + 23) // 24))
        weather = await weather_service.get_current_and_forecast(lat, lon, forecast_days)

        if not weather or "hourly" not in weather:
            return {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "total_peak_kwp": sum(g.get("peakPowerKwp", 0) for g in pv_gens),
                "panels": [
                    {
                        "id": g.get("id", ""),
                        "name": g.get("name", ""),
                        "peak_kwp": g.get("peakPowerKwp", 0),
                        "tilt": g.get("tiltDeg", 30),
                        "azimuth": g.get("azimuthDeg", 180),
                    }
                    for g in pv_gens
                ],
                "hourly": [],
                "daily_summary": {},
                "error": "Keine Wetterdaten verfuegbar",
            }

        hourly = weather["hourly"]
        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        ghis = hourly.get("shortwave_radiation", [])
        dnis = hourly.get("direct_normal_irradiance", [])
        dhis = hourly.get("diffuse_radiation", [])

        panels_info = []
        for g in pv_gens:
            panels_info.append({
                "id": g.get("id", ""),
                "name": g.get("name", ""),
                "peak_kwp": g.get("peakPowerKwp", 0),
                "tilt": g.get("tiltDeg", 30),
                "azimuth": g.get("azimuthDeg", 180),
            })

        result_hourly = []
        daily_energy: dict[str, float] = {}

        for i, time_str in enumerate(times):
            if i >= hours:
                break

            try:
                dt = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                continue

            temp_c = temps[i] if i < len(temps) else 10.0
            ghi = ghis[i] if i < len(ghis) else 0.0
            dni = dnis[i] if i < len(dnis) else 0.0
            dhi = dhis[i] if i < len(dhis) else 0.0

            # Sonnenposition
            solar_alt, solar_az = _solar_position(lat, lon, dt)

            # Summe ueber alle PV-Anlagen
            total_power_kw = 0.0
            for g in pv_gens:
                tilt = g.get("tiltDeg", 30)
                azimuth = g.get("azimuthDeg", 180)
                peak_kwp = g.get("peakPowerKwp", 0)
                efficiency = g.get("efficiency", 0.85)
                temp_coeff = g.get("temperatureCoefficient", -0.004)
                panel_albedo = g.get("albedo", 0.2)

                poa = _transpose_irradiance(
                    ghi, dni, dhi, solar_alt, solar_az, tilt, azimuth, panel_albedo
                )
                power = _calculate_pv_power(poa, peak_kwp, efficiency, temp_coeff, temp_c)
                total_power_kw += power

            result_hourly.append({
                "time": time_str,
                "power_kw": round(total_power_kw, 2),
                "ghi_wm2": round(ghi, 1),
                "temperature_c": round(temp_c, 1),
            })

            # Tagesenergie summieren
            day_key = time_str[:10]  # "2026-03-13"
            daily_energy[day_key] = daily_energy.get(day_key, 0) + total_power_kw

        # Tagesenergien in kWh (1 Datenpunkt pro Stunde)
        daily_summary = {day: round(kwh, 1) for day, kwh in daily_energy.items()}

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_peak_kwp": round(sum(g.get("peakPowerKwp", 0) for g in pv_gens), 1),
            "panels": panels_info,
            "hourly": result_hourly,
            "daily_summary": daily_summary,
        }

    async def get_accuracy(self, date_from: str, date_to: str) -> dict:
        """
        Vergleicht PV-Prognose mit tatsaechlichen Messwerten.

        Returns: {mae, rmse, mbe, correlation, hourly: [{time, forecast_kw, actual_kw}]}
        """
        from sqlalchemy import text
        from app.core.database import async_session

        async with async_session() as db:
            sql = text("""
                SELECT
                    f.timestamp,
                    f.value AS forecast_kw,
                    a.value AS actual_kw
                FROM measurements f
                JOIN measurements a
                    ON strftime('%Y-%m-%dT%H', f.timestamp) = strftime('%Y-%m-%dT%H', a.timestamp)
                WHERE f.source = 'pv_forecast' AND f.metric = 'power_kw'
                    AND a.source = 'pv' AND a.metric = 'power_kw'
                    AND f.timestamp >= :from_ts AND f.timestamp <= :to_ts
                ORDER BY f.timestamp
            """)
            result = await db.execute(sql, {"from_ts": date_from, "to_ts": date_to})
            rows = result.fetchall()

        if not rows:
            return {"mae": 0, "rmse": 0, "mbe": 0, "correlation": 0, "hourly": []}

        hourly = []
        errors = []
        forecasts = []
        actuals = []

        for row in rows:
            ts = row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0])
            fc = float(row[1])
            ac = float(row[2])
            hourly.append({"time": ts, "forecast_kw": round(fc, 2), "actual_kw": round(ac, 2)})
            errors.append(fc - ac)
            forecasts.append(fc)
            actuals.append(ac)

        n = len(errors)
        mae = sum(abs(e) for e in errors) / n
        rmse = (sum(e ** 2 for e in errors) / n) ** 0.5
        mbe = sum(errors) / n

        # Korrelation
        correlation = 0.0
        if n > 1:
            mean_f = sum(forecasts) / n
            mean_a = sum(actuals) / n
            cov = sum((f - mean_f) * (a - mean_a) for f, a in zip(forecasts, actuals)) / n
            std_f = (sum((f - mean_f) ** 2 for f in forecasts) / n) ** 0.5
            std_a = (sum((a - mean_a) ** 2 for a in actuals) / n) ** 0.5
            if std_f > 0 and std_a > 0:
                correlation = cov / (std_f * std_a)

        return {
            "mae": round(mae, 3),
            "rmse": round(rmse, 3),
            "mbe": round(mbe, 3),
            "correlation": round(correlation, 3),
            "hourly": hourly,
        }


# Singleton
pv_forecast_service = PvForecastService()
