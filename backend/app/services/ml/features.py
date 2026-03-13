"""
Feature-Engineering — Baut Trainings-Datensaetze aus Messdaten + Wetter.

Fuer jeden Prognose-Typ (PV, Last, Thermik) werden Features erzeugt:
- Zeitfeatures (Stunde, Wochentag, Monat — zirkulaer kodiert)
- Wetterfeatures (Temperatur, Bewoelkung, Wind, Einstrahlung)
- Physik-Baseline (Vorhersage des physikbasierten Modells)
- Der Target ist die Residuale: actual - physics_baseline
"""

import logging
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.core.database import async_session

logger = logging.getLogger(__name__)

# Feature-Namen pro Modelltyp
COMMON_FEATURES = [
    "hour_sin", "hour_cos", "weekday_sin", "weekday_cos",
    "month_sin", "month_cos", "is_weekend",
    "outdoor_temp_c", "cloud_cover_pct", "wind_speed_ms",
]

PV_FEATURES = COMMON_FEATURES + [
    "ghi_wm2", "dni_wm2", "dhi_wm2", "physics_baseline_kw", "solar_altitude_deg",
]

LOAD_FEATURES = COMMON_FEATURES + [
    "physics_baseline_kw", "humidity_pct",
]

THERMAL_FEATURES = COMMON_FEATURES + [
    "physics_baseline_kw", "heating_demand_kw",
]

FEATURE_SETS = {
    "pv_correction": PV_FEATURES,
    "load_correction": LOAD_FEATURES,
    "thermal_correction": THERMAL_FEATURES,
}


def _circular(value: float, period: float) -> tuple[float, float]:
    """Zirkulaere Kodierung: Wert -> (sin, cos)."""
    rad = 2 * math.pi * value / period
    return math.sin(rad), math.cos(rad)


def build_time_features(dt: datetime) -> dict:
    """Zeitfeatures fuer einen Zeitpunkt."""
    h_sin, h_cos = _circular(dt.hour, 24)
    wd_sin, wd_cos = _circular(dt.weekday(), 7)
    m_sin, m_cos = _circular(dt.month, 12)
    return {
        "hour_sin": h_sin,
        "hour_cos": h_cos,
        "weekday_sin": wd_sin,
        "weekday_cos": wd_cos,
        "month_sin": m_sin,
        "month_cos": m_cos,
        "is_weekend": 1.0 if dt.weekday() >= 5 else 0.0,
    }


async def build_training_data(
    forecast_type: str,
    days_back: int = 90,
) -> tuple[list[dict], list[float]]:
    """
    Baut Trainings-Datensatz aus Messdaten.

    Returns: (features_list, targets_list) — Listen gleicher Laenge.
    Jeder Eintrag in features_list ist ein dict mit den Feature-Werten.
    targets ist die Residuale (actual - physics_baseline).
    """
    # Bestimme Quelle und Metrik aus dem Forecast-Typ
    source_metric_map = {
        "pv_correction": ("pv", "power_kw"),
        "load_correction": ("load", "power_kw"),
        "thermal_correction": ("heat_pump", "heat_kw"),
    }

    if forecast_type not in source_metric_map:
        logger.error("Unbekannter Forecast-Typ: %s", forecast_type)
        return [], []

    source, metric = source_metric_map[forecast_type]

    # Messdaten laden (stuendlich aggregiert)
    features_list: list[dict] = []
    targets_list: list[float] = []

    try:
        async with async_session() as db:
            # Stuendliche Durchschnittswerte der letzten N Tage
            sql = text("""
                SELECT
                    strftime('%Y-%m-%dT%H:00', timestamp) AS hour_ts,
                    AVG(value) AS avg_value,
                    COUNT(*) AS cnt
                FROM measurements
                WHERE source = :source AND metric = :metric
                    AND timestamp >= datetime('now', :days_offset)
                GROUP BY strftime('%Y-%m-%dT%H', timestamp)
                HAVING cnt >= 3
                ORDER BY hour_ts
            """)
            result = await db.execute(sql, {
                "source": source,
                "metric": metric,
                "days_offset": f"-{days_back} days",
            })
            hourly_actuals = {row[0]: float(row[1]) for row in result.fetchall()}

            # Wetter-Messdaten laden (Temperatur, Bewoelkung, Wind)
            weather_sql = text("""
                SELECT
                    strftime('%Y-%m-%dT%H:00', timestamp) AS hour_ts,
                    source, metric, AVG(value) AS avg_value
                FROM measurements
                WHERE source = 'outdoor' AND metric IN ('temperature_c', 'cloud_cover_pct', 'wind_speed_ms', 'humidity_pct')
                    AND timestamp >= datetime('now', :days_offset)
                GROUP BY strftime('%Y-%m-%dT%H', timestamp), source, metric
            """)
            w_result = await db.execute(weather_sql, {"days_offset": f"-{days_back} days"})
            weather_data: dict[str, dict[str, float]] = {}
            for row in w_result.fetchall():
                ts = row[0]
                if ts not in weather_data:
                    weather_data[ts] = {}
                weather_data[ts][row[2]] = float(row[3])

            # PV-spezifisch: Einstrahlungsdaten
            if forecast_type == "pv_correction":
                solar_sql = text("""
                    SELECT
                        strftime('%Y-%m-%dT%H:00', timestamp) AS hour_ts,
                        metric, AVG(value) AS avg_value
                    FROM measurements
                    WHERE source = 'pv' AND metric IN ('ghi_wm2', 'dni_wm2', 'dhi_wm2')
                        AND timestamp >= datetime('now', :days_offset)
                    GROUP BY strftime('%Y-%m-%dT%H', timestamp), metric
                """)
                s_result = await db.execute(solar_sql, {"days_offset": f"-{days_back} days"})
                for row in s_result.fetchall():
                    ts = row[0]
                    if ts not in weather_data:
                        weather_data[ts] = {}
                    weather_data[ts][row[1]] = float(row[2])

    except Exception as e:
        logger.error("Fehler beim Laden der Trainingsdaten: %s", e)
        return [], []

    if len(hourly_actuals) < 168:  # Mindestens 7 Tage
        logger.info(
            "Zu wenig Daten fuer %s: %d Stunden (min 168)",
            forecast_type, len(hourly_actuals),
        )
        return [], []

    # Features aufbauen
    feature_names = FEATURE_SETS[forecast_type]

    for ts, actual_kw in hourly_actuals.items():
        try:
            dt = datetime.fromisoformat(ts)
        except ValueError:
            continue

        w = weather_data.get(ts, {})
        outdoor_temp = w.get("temperature_c", 10.0)

        # Physik-Baseline schaetzen (vereinfacht — Durchschnittswert der Nachbar-Stunden)
        # In der Praxis wuerde man hier den echten Physik-Forecast aufrufen,
        # aber fuer Training reicht eine Schaetzung basierend auf typischen Mustern.
        physics_baseline = _estimate_physics_baseline(forecast_type, dt, outdoor_temp, w)

        row = build_time_features(dt)
        row["outdoor_temp_c"] = outdoor_temp
        row["cloud_cover_pct"] = w.get("cloud_cover_pct", 50.0)
        row["wind_speed_ms"] = w.get("wind_speed_ms", 3.0)
        row["physics_baseline_kw"] = physics_baseline

        # Typ-spezifische Features
        if forecast_type == "pv_correction":
            row["ghi_wm2"] = w.get("ghi_wm2", 0.0)
            row["dni_wm2"] = w.get("dni_wm2", 0.0)
            row["dhi_wm2"] = w.get("dhi_wm2", 0.0)
            row["solar_altitude_deg"] = _solar_altitude(dt)
        elif forecast_type == "load_correction":
            row["humidity_pct"] = w.get("humidity_pct", 60.0)
        elif forecast_type == "thermal_correction":
            row["heating_demand_kw"] = max(0.0, (20.0 - outdoor_temp) * 0.5) if outdoor_temp < 15 else 0.0

        # Nur Features behalten die das Modell braucht
        feature_row = {k: row.get(k, 0.0) for k in feature_names}
        features_list.append(feature_row)

        # Target: Residuale
        targets_list.append(actual_kw - physics_baseline)

    logger.info(
        "Trainingsdaten fuer %s: %d Samples, %d Features",
        forecast_type, len(features_list), len(feature_names),
    )
    return features_list, targets_list


def _estimate_physics_baseline(
    forecast_type: str, dt: datetime, outdoor_temp: float, weather: dict
) -> float:
    """
    Einfache Physik-Baseline-Schaetzung fuer Training.
    Im Inference nutzen wir den echten Physik-Forecast.
    """
    hour = dt.hour

    if forecast_type == "pv_correction":
        # Vereinfachte PV-Kurve basierend auf GHI
        ghi = weather.get("ghi_wm2", 0.0)
        if ghi <= 0 or hour < 5 or hour > 21:
            return 0.0
        # Typische 10 kWp Anlage: ~85% Wirkungsgrad
        return ghi / 1000.0 * 10.0 * 0.85

    elif forecast_type == "load_correction":
        # VDI 4655 Profil (vereinfacht)
        profile = [0.4, 0.3, 0.3, 0.3, 0.35, 0.5, 0.7, 1.2, 1.4, 1.1, 0.9, 0.85,
                   1.3, 1.1, 0.9, 0.85, 0.9, 1.3, 1.8, 2.0, 1.7, 1.3, 0.8, 0.5]
        avg_kw = 5000 / 8760  # 5000 kWh/a Default
        return avg_kw * profile[hour]

    elif forecast_type == "thermal_correction":
        # Vereinfachte Heizlast
        if outdoor_temp >= 15:
            return 0.0
        return max(0, (20 - outdoor_temp) * 0.5)

    return 0.0


def _solar_altitude(dt: datetime, lat: float = 48.1) -> float:
    """Vereinfachte Sonnenhoehe fuer Feature-Engineering."""
    day_of_year = dt.timetuple().tm_yday
    declination = 23.45 * math.sin(math.radians(360 / 365 * (day_of_year - 81)))
    hour_angle = 15.0 * (dt.hour - 12.0)

    lat_rad = math.radians(lat)
    dec_rad = math.radians(declination)
    ha_rad = math.radians(hour_angle)

    sin_alt = (
        math.sin(lat_rad) * math.sin(dec_rad)
        + math.cos(lat_rad) * math.cos(dec_rad) * math.cos(ha_rad)
    )
    return math.degrees(math.asin(max(-1, min(1, sin_alt))))
