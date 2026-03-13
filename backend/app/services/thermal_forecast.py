"""
Thermische Prognose — Berechnet erwartete Heizlast, WP-Betrieb und Speichertemperatur.

Verwendet:
- Wettervorhersage (Aussentemperatur) von Open-Meteo
- Gebaeudekenndaten aus SystemSettings (Heizgrenze, Daemmstandard, Heizwaermebedarf)
- WP-Konfiguration aus GeneratorConfig (Heizleistung, COP-Kennlinie)
- Pufferspeicher aus StorageConfig (Volumen, Temperaturgrenzen)
- Heizkreise aus CircuitConfig (Heizkurve, Auslegungstemperatur)
- Historische Messdaten fuer Musterabgleich

Spaeter erweiterbar durch ML (Phase 3).
"""

import logging
import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.core.database import async_session
from app.models.config import (
    CircuitConfig,
    GeneratorConfig,
    StorageConfig,
    SystemSettingsConfig,
)
from app.services.weather import weather_service

logger = logging.getLogger(__name__)

# Daemmstandard -> spezifischer Waermeverlust W/(m2*K)
INSULATION_U_VALUES = {
    "poor": 1.8,        # Altbau unsaniert
    "average": 1.0,     # Teilsaniert
    "good": 0.5,        # EnEV/GEG Standard
    "passive_house": 0.15,  # Passivhaus
}


def _heating_demand_kw(
    outdoor_temp_c: float,
    indoor_target_c: float,
    heated_area_m2: float,
    u_value: float,
    heating_threshold_c: float,
) -> float:
    """
    Heizlast nach vereinfachtem stationaeren Verfahren.

    Q = U * A * (T_innen - T_aussen)
    Ergebnis in kW.
    """
    if outdoor_temp_c >= heating_threshold_c:
        return 0.0
    delta_t = indoor_target_c - outdoor_temp_c
    return max(0.0, u_value * heated_area_m2 * delta_t / 1000.0)


def _cop_at_temp(outdoor_temp_c: float, cop_curve: list[dict] | None, cop_rated: float) -> float:
    """
    COP der Waermepumpe bei gegebener Aussentemperatur.
    Interpoliert aus cop_curve oder berechnet Naeherung.
    """
    if cop_curve and len(cop_curve) >= 2:
        # Sortieren nach Temperatur
        curve = sorted(cop_curve, key=lambda p: p.get("outdoorTempC", 0))
        temp = outdoor_temp_c

        # Unterhalb des kleinsten Punktes
        if temp <= curve[0].get("outdoorTempC", -10):
            return max(1.5, curve[0].get("cop", 2.0))
        # Oberhalb des groessten Punktes
        if temp >= curve[-1].get("outdoorTempC", 35):
            return curve[-1].get("cop", 5.0)

        # Lineare Interpolation
        for j in range(len(curve) - 1):
            t0 = curve[j].get("outdoorTempC", 0)
            t1 = curve[j + 1].get("outdoorTempC", 0)
            if t0 <= temp <= t1:
                frac = (temp - t0) / (t1 - t0) if t1 != t0 else 0
                c0 = curve[j].get("cop", 3.0)
                c1 = curve[j + 1].get("cop", 3.0)
                return c0 + frac * (c1 - c0)

    # Fallback: Naeherungsformel (Luft-WP)
    return max(1.5, cop_rated - 0.08 * (7 - outdoor_temp_c))


def _flow_temperature(
    outdoor_temp_c: float,
    design_outdoor_c: float,
    design_flow_c: float,
    steepness: float,
    parallel_shift: float,
    indoor_target_c: float = 21.0,
) -> float:
    """
    Heizkurven-Berechnung: Vorlauftemperatur abhaengig von Aussentemperatur.
    """
    if outdoor_temp_c >= indoor_target_c:
        return indoor_target_c

    # Normierter Aussentemperatur-Anteil
    ratio = (indoor_target_c - outdoor_temp_c) / (indoor_target_c - design_outdoor_c)
    ratio = max(0, min(1.5, ratio))

    flow_temp = indoor_target_c + steepness * (design_flow_c - indoor_target_c) * ratio + parallel_shift
    return max(indoor_target_c, min(75.0, flow_temp))


class ThermalForecastService:
    """Berechnet thermische Prognose: Heizlast, WP-Betrieb, Speichertemperatur."""

    async def _load_config(self) -> dict:
        """Laedt alle relevanten Konfigurationen."""
        async with async_session() as db:
            settings_r = await db.execute(select(SystemSettingsConfig))
            row = settings_r.scalar_one_or_none()
            settings = row.data if row else {}

            gen_r = await db.execute(select(GeneratorConfig))
            generators = [r.data for r in gen_r.scalars()]

            stor_r = await db.execute(select(StorageConfig))
            storages = [r.data for r in stor_r.scalars()]

            circ_r = await db.execute(select(CircuitConfig))
            circuits = [r.data for r in circ_r.scalars()]

        return {
            "settings": settings,
            "generators": generators,
            "storages": storages,
            "circuits": circuits,
        }

    async def _get_historical_heat_demand(self, hour: int, weekday: int) -> float | None:
        """Gleitender Durchschnitt der WP-Waermeleistung fuer diese Stunde."""
        try:
            async with async_session() as db:
                sqlite_weekday = (weekday + 1) % 7
                sql = text("""
                    SELECT AVG(value)
                    FROM measurements
                    WHERE source = 'heat_pump' AND metric = 'heat_kw'
                        AND CAST(strftime('%H', timestamp) AS INTEGER) = :hour
                        AND CAST(strftime('%w', timestamp) AS INTEGER) = :weekday
                        AND timestamp >= datetime('now', '-28 days')
                """)
                result = await db.execute(sql, {"hour": hour, "weekday": sqlite_weekday})
                row = result.fetchone()
                if row and row[0] is not None:
                    return float(row[0])
        except Exception as e:
            logger.debug("Historische Waermedaten nicht verfuegbar: %s", e)
        return None

    async def get_forecast(self, hours: int = 72) -> dict:
        """
        Thermische Prognose fuer die naechsten Stunden.

        Returns: {
            generated_at, building,
            hourly: [{time, outdoor_temp_c, heating_demand_kw, hp_thermal_kw,
                      hp_electric_kw, hp_cop, boiler_kw, storage_temp_c, flow_temp_c}],
            daily_summary: {day: {heating_kwh, hp_electric_kwh, boiler_kwh}}
        }
        """
        config = await self._load_config()
        settings = config["settings"]

        # Gebaeudeparameter
        heated_area = settings.get("heatedArea", 130)
        insulation = settings.get("insulationStandard", "average")
        u_value = INSULATION_U_VALUES.get(insulation, 1.0)
        indoor_target = settings.get("targetRoomTemperatureC", 21)
        night_setback = settings.get("nightSetbackK", 3)
        heating_threshold = settings.get("heatingThresholdOutdoorC", 15)
        hot_water_temp = settings.get("hotWaterTemperatureC", 55)
        lat = settings.get("latitude", 48.1)
        lon = settings.get("longitude", 11.6)

        # WP-Konfiguration
        hp_configs = [g for g in config["generators"] if g.get("type") == "heat_pump"]
        total_hp_thermal_kw = sum(g.get("heatingPowerKw", 0) for g in hp_configs)
        hp_cop_rated = hp_configs[0].get("copRated", 3.5) if hp_configs else 3.5
        hp_cop_curve = hp_configs[0].get("copCurve", []) if hp_configs else []
        hp_min_modulation = hp_configs[0].get("modulationMinPercent", 30) / 100.0 if hp_configs else 0.3

        # Kessel-Konfiguration
        boiler_configs = [g for g in config["generators"] if g.get("type") == "boiler"]
        total_boiler_kw = sum(g.get("nominalPowerKw", 0) for g in boiler_configs)

        # Pufferspeicher
        heat_storages = [s for s in config["storages"] if s.get("type") in ("heat",)]
        storage_volume_l = sum(s.get("volumeLiters", 0) for s in heat_storages)
        storage_max_temp = heat_storages[0].get("maxTemperatureC", 80) if heat_storages else 80
        storage_min_temp = heat_storages[0].get("minTemperatureC", 30) if heat_storages else 30
        storage_target_temp = heat_storages[0].get("targetTemperatureC", 55) if heat_storages else 55
        storage_hysteresis = heat_storages[0].get("hysteresisK", 5) if heat_storages else 5
        storage_loss_w_per_k = heat_storages[0].get("heatLossCoefficientWPerK", 2.0) if heat_storages else 2.0
        # Waermekapazitaet: 1 Liter Wasser ~ 1.16 Wh/K
        storage_capacity_kwh_per_k = storage_volume_l * 1.16 / 1000.0 if storage_volume_l > 0 else 1.7

        # Heizkreis
        circuits = config["circuits"]
        design_outdoor = circuits[0].get("designOutdoorTemperatureC", -12) if circuits else -12
        design_flow = circuits[0].get("flowTemperatureC", 55) if circuits else 55
        hc = circuits[0].get("heatingCurve", {}) if circuits else {}
        hc_steepness = hc.get("steepness", 1.2)
        hc_parallel = hc.get("parallelShift", 0)

        # Wettervorhersage
        forecast_days = max(1, min(7, (hours + 23) // 24))
        weather = await weather_service.get_current_and_forecast(lat, lon, forecast_days)

        temps_by_hour: dict[str, float] = {}
        if weather and "hourly" in weather:
            times = weather["hourly"].get("time", [])
            temps = weather["hourly"].get("temperature_2m", [])
            for i, t in enumerate(times):
                if i < len(temps):
                    temps_by_hour[t] = temps[i]

        # Simulation
        result_hourly = []
        daily_energy: dict[str, dict[str, float]] = {}
        now = datetime.now(timezone.utc)

        # Initialer Speicher-Zustand
        storage_temp = storage_target_temp

        for h in range(hours):
            dt = datetime(now.year, now.month, now.day, now.hour, 0, 0, tzinfo=timezone.utc)
            dt = dt + timedelta(hours=h)

            hour_float = dt.hour + dt.minute / 60.0
            weekday = dt.weekday()
            time_str = dt.strftime("%Y-%m-%dT%H:00")

            # Aussentemperatur
            outdoor_temp = temps_by_hour.get(time_str, 5.0)

            # Nachtabsenkung (22-6 Uhr)
            effective_indoor = indoor_target
            if 22 <= dt.hour or dt.hour < 6:
                effective_indoor = indoor_target - night_setback

            # Heizlast
            demand_kw = _heating_demand_kw(
                outdoor_temp, effective_indoor, heated_area, u_value, heating_threshold
            )

            # Warmwasser-Grundlast (~0.3 kW kontinuierlich, Spitzen morgens/abends)
            hw_profile = [0.1, 0.1, 0.1, 0.1, 0.1, 0.2,
                          0.6, 0.8, 0.5, 0.3, 0.2, 0.2,
                          0.3, 0.2, 0.2, 0.2, 0.2, 0.4,
                          0.6, 0.5, 0.4, 0.3, 0.2, 0.1]
            hw_kw = hw_profile[dt.hour % 24] * settings.get("occupants", 4) * 0.5

            total_demand_kw = demand_kw + hw_kw

            # Historischer Abgleich
            hist_heat = await self._get_historical_heat_demand(dt.hour, weekday)
            if hist_heat is not None and hist_heat > 0 and h < 24:
                # Nur fuer die ersten 24h blenden (danach zu unsicher)
                total_demand_kw = 0.6 * total_demand_kw + 0.4 * hist_heat

            # Vorlauftemperatur
            flow_temp = _flow_temperature(
                outdoor_temp, design_outdoor, design_flow,
                hc_steepness, hc_parallel, indoor_target
            )

            # COP
            cop = _cop_at_temp(outdoor_temp, hp_cop_curve, hp_cop_rated)

            # WP-Betrieb
            hp_thermal_kw = 0.0
            hp_electric_kw = 0.0
            boiler_kw = 0.0

            if total_hp_thermal_kw > 0 and total_demand_kw > 0:
                # WP deckt Bedarf bis zur Maximalleistung
                hp_thermal_kw = min(total_demand_kw, total_hp_thermal_kw)

                # Mindest-Modulation
                if hp_thermal_kw < total_hp_thermal_kw * hp_min_modulation and hp_thermal_kw > 0:
                    hp_thermal_kw = total_hp_thermal_kw * hp_min_modulation

                hp_electric_kw = hp_thermal_kw / cop if cop > 0 else 0

            # Kessel springt ein wenn WP nicht reicht oder Speicher zu kalt
            deficit = total_demand_kw - hp_thermal_kw
            if total_boiler_kw > 0:
                if deficit > 0.1 or storage_temp < (storage_target_temp - storage_hysteresis):
                    boiler_kw = min(deficit + 2.0, total_boiler_kw)  # +2 kW Nachladeanteil
                    boiler_kw = max(boiler_kw, total_boiler_kw * 0.3)  # Min 30% Modulation

            # Speichertemperatur-Update (stundlich)
            if storage_volume_l > 0:
                net_heat_kwh = (hp_thermal_kw + boiler_kw - total_demand_kw) * 1.0  # 1 Stunde
                # Verluste
                storage_loss_kw = storage_loss_w_per_k * (storage_temp - 20) / 1000.0
                net_heat_kwh -= storage_loss_kw

                temp_change = net_heat_kwh / storage_capacity_kwh_per_k
                storage_temp = max(storage_min_temp, min(storage_max_temp, storage_temp + temp_change))

            result_hourly.append({
                "time": time_str,
                "outdoor_temp_c": round(outdoor_temp, 1),
                "heating_demand_kw": round(demand_kw, 2),
                "hot_water_kw": round(hw_kw, 2),
                "total_thermal_demand_kw": round(total_demand_kw, 2),
                "hp_thermal_kw": round(hp_thermal_kw, 2),
                "hp_electric_kw": round(hp_electric_kw, 2),
                "hp_cop": round(cop, 2),
                "boiler_kw": round(boiler_kw, 2),
                "storage_temp_c": round(storage_temp, 1),
                "flow_temp_c": round(flow_temp, 1),
            })

            # Tagesenergie
            day_key = time_str[:10]
            if day_key not in daily_energy:
                daily_energy[day_key] = {"heating_kwh": 0, "hp_electric_kwh": 0, "boiler_kwh": 0, "hot_water_kwh": 0}
            daily_energy[day_key]["heating_kwh"] += demand_kw
            daily_energy[day_key]["hp_electric_kwh"] += hp_electric_kw
            daily_energy[day_key]["boiler_kwh"] += boiler_kw
            daily_energy[day_key]["hot_water_kwh"] += hw_kw

        # Runden
        daily_summary = {
            day: {k: round(v, 1) for k, v in vals.items()}
            for day, vals in daily_energy.items()
        }

        return {
            "generated_at": now.isoformat(),
            "building": {
                "heated_area_m2": heated_area,
                "insulation_standard": insulation,
                "u_value_w_m2k": u_value,
                "heating_threshold_c": heating_threshold,
                "indoor_target_c": indoor_target,
            },
            "heat_pump": {
                "total_thermal_kw": total_hp_thermal_kw,
                "cop_rated": hp_cop_rated,
                "count": len(hp_configs),
            },
            "boiler": {
                "total_kw": total_boiler_kw,
                "count": len(boiler_configs),
            },
            "storage": {
                "volume_liters": storage_volume_l,
                "target_temp_c": storage_target_temp,
                "capacity_kwh_per_k": round(storage_capacity_kwh_per_k, 2),
            },
            "hourly": result_hourly,
            "daily_summary": daily_summary,
        }


# Singleton
thermal_forecast_service = ThermalForecastService()
