"""
Optimizer — Multi-Kriterien Einsatzplanung mit gewichteter Bewertung.

Erstellt einen stundenweisen Fahrplan (Schedule) fuer:
- Batterie (Laden/Entladen)
- Waermepumpe (Modulation)
- Kessel (Zuschaltung)
- Netz (Import/Export)

Bewertungskriterien (gewichtet via OptimizerWeights):
1. Wirtschaftlichkeit (economy) — Kosten minimieren
2. CO2-Reduktion (co2Reduction) — Emissionen minimieren
3. Komfort (comfort) — Temperaturen halten
4. Eigenverbrauch (selfConsumption) — PV lokal nutzen
5. Netzdienlichkeit (gridFriendly) — Spitzen glaetten
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import async_session
from app.models.config import (
    GeneratorConfig,
    StorageConfig,
    SystemSettingsConfig,
)
from app.services.load_forecast import load_forecast_service
from app.services.pv_forecast import pv_forecast_service
from app.services.thermal_forecast import thermal_forecast_service

logger = logging.getLogger(__name__)

# CO2-Intensitaet in kg/kWh (Deutschland Strommix)
GRID_CO2_KG_PER_KWH = 0.400
GAS_CO2_KG_PER_KWH = 0.202  # Erdgas


@dataclass
class HourlySetpoint:
    """Optimierte Stellgroessen fuer eine Stunde."""
    time: str
    # Erzeugung / Verbrauch
    pv_forecast_kw: float = 0.0
    load_forecast_kw: float = 0.0
    # Batterie
    battery_setpoint_kw: float = 0.0  # +laden, -entladen
    battery_soc_pct: float = 0.0
    # Thermisch
    hp_thermal_kw: float = 0.0
    hp_electric_kw: float = 0.0
    hp_cop: float = 0.0
    boiler_kw: float = 0.0
    storage_temp_c: float = 0.0
    heating_demand_kw: float = 0.0
    # Netz
    grid_kw: float = 0.0  # +Bezug, -Einspeisung
    # KPIs
    cost_ct: float = 0.0
    co2_kg: float = 0.0
    self_consumption_pct: float = 0.0
    # Strategie-Info
    strategy: str = ""


@dataclass
class OptimizationSchedule:
    """Kompletter Fahrplan mit Zusammenfassung."""
    generated_at: str = ""
    hours: int = 24
    weights: dict = field(default_factory=dict)
    hourly: list[HourlySetpoint] = field(default_factory=list)
    # Zusammenfassung
    total_cost_eur: float = 0.0
    total_revenue_eur: float = 0.0
    net_cost_eur: float = 0.0
    total_co2_kg: float = 0.0
    avg_self_consumption_pct: float = 0.0
    peak_grid_import_kw: float = 0.0
    peak_grid_export_kw: float = 0.0
    total_pv_kwh: float = 0.0
    total_grid_import_kwh: float = 0.0
    total_grid_export_kwh: float = 0.0
    total_battery_charged_kwh: float = 0.0
    total_battery_discharged_kwh: float = 0.0
    strategy_description: str = ""


class EnergyOptimizer:
    """Multi-Kriterien Optimierer mit gewichteter Bewertung."""

    async def _load_config(self) -> dict:
        """Laedt Systemkonfiguration + Geraeteparameter."""
        async with async_session() as db:
            settings_r = await db.execute(select(SystemSettingsConfig))
            row = settings_r.scalar_one_or_none()
            settings = row.data if row else {}

            gen_r = await db.execute(select(GeneratorConfig))
            generators = [r.data for r in gen_r.scalars()]

            stor_r = await db.execute(select(StorageConfig))
            storages = [r.data for r in stor_r.scalars()]

        return {"settings": settings, "generators": generators, "storages": storages}

    def _get_tariff_ct(self, settings: dict, hour: int, weekday: int) -> float:
        """Strompreis in ct/kWh fuer eine Stunde (Tarif-abhaengig)."""
        tariff_type = settings.get("tariffType", "fixed")
        base = settings.get("gridConsumptionCtPerKwh", 30)

        if tariff_type == "fixed":
            return base

        if tariff_type == "time_of_use":
            periods = settings.get("timeOfUsePeriods", [])
            for p in periods:
                days = p.get("days", [])
                day_names = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
                if day_names[weekday].lower() in [d.lower() for d in days]:
                    if p.get("startHour", 0) <= hour < p.get("endHour", 24):
                        return p.get("priceCtPerKwh", base)
            return base

        if tariff_type == "dynamic":
            # Vereinfachtes Modell: guenstiger nachts, teurer tagsuerber
            if 0 <= hour < 6:
                return base * 0.7
            elif 6 <= hour < 8:
                return base * 0.9
            elif 17 <= hour < 20:
                return base * 1.3  # Spitzenzeit
            return base

        return base

    def _score_economy(
        self, grid_kw: float, tariff_ct: float, feed_in_ct: float,
        boiler_kw: float, gas_price_ct: float,
    ) -> tuple[float, float]:
        """Wirtschaftlichkeits-Bewertung. Gibt (Score 0-1, Kosten ct) zurueck."""
        cost_ct = 0.0
        if grid_kw > 0:
            cost_ct = grid_kw * tariff_ct / 100.0  # Bezugskosten pro Stunde
        else:
            cost_ct = grid_kw * feed_in_ct / 100.0  # Einnahmen (negativ)
        cost_ct += boiler_kw * gas_price_ct / 100.0  # Gaskosten

        # Score: Je weniger Kosten, desto besser (normalisiert)
        # Referenz: 5 kW Bezug * 30ct = 1.5 ct/h
        max_cost = 5.0 * tariff_ct / 100.0
        score = max(0, 1.0 - cost_ct / max_cost) if max_cost > 0 else 0.5
        return min(1.0, score), cost_ct

    def _score_co2(
        self, grid_kw: float, boiler_kw: float, pv_self_kw: float,
    ) -> tuple[float, float]:
        """CO2-Bewertung. Gibt (Score 0-1, CO2 kg) zurueck."""
        co2 = 0.0
        if grid_kw > 0:
            co2 += grid_kw * GRID_CO2_KG_PER_KWH
        co2 += boiler_kw * GAS_CO2_KG_PER_KWH

        # Score: Je mehr PV-Eigenverbrauch und weniger fossil, desto besser
        max_co2 = 5.0 * GRID_CO2_KG_PER_KWH
        score = max(0, 1.0 - co2 / max_co2) if max_co2 > 0 else 0.5
        return min(1.0, score), co2

    def _score_comfort(
        self, storage_temp: float, target_temp: float, hysteresis: float,
    ) -> float:
        """Komfort-Bewertung basierend auf Speichertemperatur."""
        delta = abs(storage_temp - target_temp)
        if delta <= hysteresis:
            return 1.0
        return max(0, 1.0 - (delta - hysteresis) / 15.0)

    def _score_self_consumption(
        self, pv_kw: float, self_consumed_kw: float,
    ) -> float:
        """Eigenverbrauchs-Bewertung."""
        if pv_kw <= 0.01:
            return 0.5  # Nachts irrelevant
        return min(1.0, self_consumed_kw / pv_kw)

    def _score_grid_friendly(
        self, grid_kw: float, avg_grid_kw: float,
    ) -> float:
        """Netzdienlichkeits-Bewertung (Spitzenlast-Glaettung)."""
        if avg_grid_kw <= 0:
            avg_grid_kw = 2.0
        deviation = abs(grid_kw) / max(1.0, avg_grid_kw)
        return max(0, 1.0 - (deviation - 1.0) * 0.5)

    def _weighted_score(self, weights: dict, scores: dict) -> float:
        """Gewichtete Gesamtbewertung."""
        w = {
            "economy": weights.get("economy", 80) / 100.0,
            "co2": weights.get("co2Reduction", 50) / 100.0,
            "comfort": weights.get("comfort", 70) / 100.0,
            "self_consumption": weights.get("selfConsumption", 60) / 100.0,
            "grid_friendly": weights.get("gridFriendly", 30) / 100.0,
        }
        total_weight = sum(w.values())
        if total_weight == 0:
            return 0.5

        total = (
            w["economy"] * scores.get("economy", 0.5)
            + w["co2"] * scores.get("co2", 0.5)
            + w["comfort"] * scores.get("comfort", 0.5)
            + w["self_consumption"] * scores.get("self_consumption", 0.5)
            + w["grid_friendly"] * scores.get("grid_friendly", 0.5)
        )
        return total / total_weight

    async def create_schedule(self, hours: int = 24, solver: str = "auto") -> dict:
        """
        Erstellt optimierten Fahrplan.

        solver: "auto" (MILP bevorzugt), "milp" (nur MILP), "heuristic" (nur Heuristik)
        Returns: OptimizationSchedule als dict.
        """
        config = await self._load_config()

        if solver in ("auto", "milp"):
            try:
                result = await self._create_schedule_milp(config, hours)
                if result is not None:
                    return result
            except Exception as e:
                logger.warning("MILP-Solver fehlgeschlagen, Fallback auf Heuristik: %s", e)
            if solver == "milp":
                return {"error": "MILP-Solver nicht verfuegbar", "solver": "milp"}

        return await self._create_schedule_heuristic(config, hours)

    async def _create_schedule_milp(self, config: dict, hours: int) -> dict | None:
        """MILP-basierte Optimierung mit PuLP/CBC."""
        from app.services.optimizer_milp import MilpParams, solve_milp

        settings = config["settings"]
        weights = settings.get("optimizerWeights", {
            "co2Reduction": 50, "economy": 80, "comfort": 70,
            "selfConsumption": 60, "gridFriendly": 30,
        })

        # Tarif-Parameter
        grid_price_ct = settings.get("gridConsumptionCtPerKwh", 30)
        feed_in_ct = settings.get("gridFeedInCtPerKwh", 8.2)
        gas_price_ct = settings.get("gasPriceCtPerKwh", 8)

        # Batterie-Parameter
        batteries = [s for s in config["storages"] if s.get("type") == "battery"]
        bat_capacity = sum(s.get("capacityKwh", 0) for s in batteries)
        bat_max_ch = sum(s.get("maxChargePowerKw", s.get("capacityKwh", 10) * 0.5) for s in batteries)
        bat_max_dis = sum(s.get("maxDischargePowerKw", s.get("capacityKwh", 10) * 0.5) for s in batteries)
        bat_min_soc = max(s.get("minSocPercent", 10) for s in batteries) if batteries else 10
        bat_max_soc = min(s.get("maxSocPercent", 95) for s in batteries) if batteries else 95
        bat_eta_ch = batteries[0].get("chargeEfficiency", 0.95) if batteries else 0.95
        bat_eta_dis = batteries[0].get("dischargeEfficiency", 0.95) if batteries else 0.95
        bat_soc_init = batteries[0].get("initialSocPercent", 50) if batteries else 50

        # Thermische Parameter
        heat_storages = [s for s in config["storages"] if s.get("type") in ("heat",)]
        storage_vol = sum(s.get("volumeLiters", 0) for s in heat_storages)
        storage_cap = storage_vol * 1.16 / 1000 if storage_vol > 0 else 1.7
        storage_min = heat_storages[0].get("minTemperatureC", 30) if heat_storages else 30
        storage_max = heat_storages[0].get("maxTemperatureC", 80) if heat_storages else 80
        storage_target = heat_storages[0].get("targetTemperatureC", 55) if heat_storages else 55
        storage_loss = heat_storages[0].get("heatLossCoefficientWPerK", 2.0) if heat_storages else 2.0

        hp_configs = [g for g in config["generators"] if g.get("type") == "heat_pump"]
        hp_max = sum(g.get("heatingPowerKw", 0) for g in hp_configs)
        boiler_configs = [g for g in config["generators"] if g.get("type") == "boiler"]
        boiler_max = sum(g.get("nominalPowerKw", 0) for g in boiler_configs)

        # Prognosen
        pv_fc = await pv_forecast_service.get_forecast(hours)
        load_fc = await load_forecast_service.get_forecast(hours)
        thermal_fc = await thermal_forecast_service.get_forecast(hours)

        now = datetime.now(timezone.utc)

        pv_list = []
        load_list = []
        demand_list = []
        cop_list = []
        tariff_list = []
        time_strs = []

        pv_h = {h["time"]: h for h in pv_fc.get("hourly", [])}
        load_h = {h["time"]: h for h in load_fc.get("hourly", [])}
        therm_h = {h["time"]: h for h in thermal_fc.get("hourly", [])}

        for h in range(hours):
            dt = datetime(now.year, now.month, now.day, now.hour, 0, 0, tzinfo=timezone.utc)
            dt = dt + timedelta(hours=h)
            ts = dt.strftime("%Y-%m-%dT%H:00")
            time_strs.append(ts)

            pv_list.append(pv_h.get(ts, {}).get("power_kw", 0))
            load_list.append(load_h.get(ts, {}).get("power_kw", 0))
            th = therm_h.get(ts, {})
            demand_list.append(th.get("heating_demand_kw", 0) + th.get("hot_water_kw", 0))
            cop_list.append(th.get("hp_cop", 3.5))
            tariff_list.append(self._get_tariff_ct(settings, dt.hour, dt.weekday()))

        # MILP loesen
        params = MilpParams(
            hours=hours,
            pv_kw=pv_list,
            load_kw=load_list,
            thermal_demand_kw=demand_list,
            cop=cop_list,
            tariff_ct=tariff_list,
            feed_in_ct=feed_in_ct,
            gas_price_ct=gas_price_ct,
            bat_capacity_kwh=bat_capacity,
            bat_max_charge_kw=bat_max_ch,
            bat_max_discharge_kw=bat_max_dis,
            bat_soc_min_pct=bat_min_soc,
            bat_soc_max_pct=bat_max_soc,
            bat_soc_initial_pct=bat_soc_init,
            bat_eta_charge=bat_eta_ch,
            bat_eta_discharge=bat_eta_dis,
            hp_max_thermal_kw=hp_max,
            boiler_max_kw=boiler_max,
            storage_capacity_kwh_per_k=storage_cap,
            storage_temp_min=storage_min,
            storage_temp_max=storage_max,
            storage_temp_initial=storage_target,
            storage_temp_target=storage_target,
            storage_loss_w_per_k=storage_loss,
            w_economy=weights.get("economy", 80),
            w_co2=weights.get("co2Reduction", 50),
            w_comfort=weights.get("comfort", 70),
            w_self_consumption=weights.get("selfConsumption", 60),
            w_grid_friendly=weights.get("gridFriendly", 30),
        )

        result = solve_milp(params)
        if result is None:
            return None

        # Ergebnis in Standard-Format konvertieren
        result_hourly = []
        for t in range(hours):
            bat_net = result.bat_charge_kw[t] - result.bat_discharge_kw[t]
            grid_net = result.grid_import_kw[t] - result.grid_export_kw[t]
            hp_therm = result.hp_thermal_kw[t]
            hp_elec = hp_therm / max(1.5, cop_list[t])
            boiler_val = result.boiler_kw[t]
            pv = pv_list[t]
            load = load_list[t]
            tariff = tariff_list[t]

            # Kosten
            cost_ct = 0.0
            if grid_net > 0:
                cost_ct = grid_net * tariff / 100.0
            else:
                cost_ct = grid_net * feed_in_ct / 100.0
            cost_ct += boiler_val * gas_price_ct / 100.0

            # CO2
            co2 = max(0, grid_net) * 0.400 + boiler_val * 0.202

            # Eigenverbrauch
            self_consumed = min(pv, load + hp_elec + max(0, bat_net))
            sc_pct = (self_consumed / pv * 100) if pv > 0.01 else 0

            result_hourly.append({
                "time": time_strs[t],
                "pv_forecast_kw": round(pv, 2),
                "load_forecast_kw": round(load, 2),
                "battery_setpoint_kw": round(bat_net, 2),
                "battery_soc_pct": round(result.soc_pct[t + 1], 1),
                "hp_thermal_kw": round(hp_therm, 2),
                "hp_electric_kw": round(hp_elec, 2),
                "hp_cop": round(cop_list[t], 2),
                "boiler_kw": round(boiler_val, 2),
                "storage_temp_c": round(result.storage_temp_c[t + 1], 1),
                "heating_demand_kw": round(demand_list[t], 2),
                "grid_kw": round(grid_net, 2),
                "cost_ct": round(cost_ct, 2),
                "co2_kg": round(co2, 4),
                "self_consumption_pct": round(sc_pct, 1),
                "tariff_ct": round(tariff, 1),
                "strategy": "MILP-optimiert",
            })

        # Zusammenfassung
        total_cost = sum(h["cost_ct"] for h in result_hourly if h["cost_ct"] > 0)
        total_revenue = abs(sum(h["cost_ct"] for h in result_hourly if h["cost_ct"] < 0))
        total_co2 = sum(h["co2_kg"] for h in result_hourly)
        sc_hours = [h["self_consumption_pct"] for h in result_hourly if h["pv_forecast_kw"] > 0.01]
        avg_sc = sum(sc_hours) / len(sc_hours) if sc_hours else 0
        peak_imp = max((h["grid_kw"] for h in result_hourly), default=0)
        peak_exp = abs(min((h["grid_kw"] for h in result_hourly), default=0))
        total_pv = sum(h["pv_forecast_kw"] for h in result_hourly)
        total_imp = sum(h["grid_kw"] for h in result_hourly if h["grid_kw"] > 0)
        total_exp = abs(sum(h["grid_kw"] for h in result_hourly if h["grid_kw"] < 0))
        total_ch = sum(h["battery_setpoint_kw"] for h in result_hourly if h["battery_setpoint_kw"] > 0)
        total_dis = abs(sum(h["battery_setpoint_kw"] for h in result_hourly if h["battery_setpoint_kw"] < 0))

        dominant = max(weights, key=lambda k: weights.get(k, 0))
        strategy_map = {
            "economy": "Kostenoptimiert", "co2Reduction": "Klimafreundlich",
            "comfort": "Komfortorientiert", "selfConsumption": "Eigenverbrauch maximiert",
            "gridFriendly": "Netzdienlich",
        }

        return {
            "generated_at": now.isoformat(),
            "hours": hours,
            "weights": weights,
            "strategy": strategy_map.get(dominant, "Ausgewogen"),
            "strategy_description": self._describe_strategy(weights),
            "solver": "milp",
            "solve_time_ms": result.solve_time_ms,
            "summary": {
                "total_cost_ct": round(total_cost, 1),
                "total_revenue_ct": round(total_revenue, 1),
                "net_cost_ct": round(total_cost - total_revenue, 1),
                "total_co2_kg": round(total_co2, 2),
                "avg_self_consumption_pct": round(avg_sc, 1),
                "peak_grid_import_kw": round(peak_imp, 2),
                "peak_grid_export_kw": round(peak_exp, 2),
                "total_pv_kwh": round(total_pv, 1),
                "total_grid_import_kwh": round(total_imp, 1),
                "total_grid_export_kwh": round(total_exp, 1),
                "total_battery_charged_kwh": round(total_ch, 1),
                "total_battery_discharged_kwh": round(total_dis, 1),
            },
            "hourly": result_hourly,
        }

    async def _create_schedule_heuristic(self, config: dict, hours: int) -> dict:
        """Heuristik-basierte Optimierung (Fallback)."""
        settings = config["settings"]
        weights = settings.get("optimizerWeights", {
            "co2Reduction": 50, "economy": 80, "comfort": 70,
            "selfConsumption": 60, "gridFriendly": 30,
        })

        # Tarif-Parameter
        grid_price_ct = settings.get("gridConsumptionCtPerKwh", 30)
        feed_in_ct = settings.get("gridFeedInCtPerKwh", 8.2)
        gas_price_ct = settings.get("gasPriceCtPerKwh", 8)

        # Batterie-Parameter
        batteries = [s for s in config["storages"] if s.get("type") == "battery"]
        bat_capacity_kwh = sum(s.get("capacityKwh", 0) for s in batteries)
        bat_max_charge = sum(s.get("maxChargePowerKw", s.get("capacityKwh", 10) * 0.5) for s in batteries)
        bat_max_discharge = sum(s.get("maxDischargePowerKw", s.get("capacityKwh", 10) * 0.5) for s in batteries)
        bat_min_soc = max(s.get("minSocPercent", 10) for s in batteries) if batteries else 10
        bat_max_soc = min(s.get("maxSocPercent", 95) for s in batteries) if batteries else 95
        bat_charge_eff = batteries[0].get("chargeEfficiency", 0.95) if batteries else 0.95
        bat_discharge_eff = batteries[0].get("dischargeEfficiency", 0.95) if batteries else 0.95
        bat_soc = batteries[0].get("initialSocPercent", 50) if batteries else 50

        # Thermisch-Parameter
        storage_target = settings.get("hotWaterTemperatureC", 55)
        storage_hysteresis = 5

        # Prognosen abrufen
        pv_fc = await pv_forecast_service.get_forecast(hours)
        load_fc = await load_forecast_service.get_forecast(hours)
        thermal_fc = await thermal_forecast_service.get_forecast(hours)

        pv_hourly = {h["time"]: h for h in pv_fc.get("hourly", [])}
        load_hourly = {h["time"]: h for h in load_fc.get("hourly", [])}
        thermal_hourly = {h["time"]: h for h in thermal_fc.get("hourly", [])}

        # Durchschnittlicher Netzbezug fuer Grid-Friendly Score
        avg_load = sum(h.get("power_kw", 0) for h in load_fc.get("hourly", [])) / max(1, hours)

        # Strategie bestimmen
        dominant = max(weights, key=lambda k: weights.get(k, 0))
        strategy_map = {
            "economy": "Kostenoptimiert",
            "co2Reduction": "Klimafreundlich",
            "comfort": "Komfortorientiert",
            "selfConsumption": "Eigenverbrauch maximiert",
            "gridFriendly": "Netzdienlich",
        }
        strategy_name = strategy_map.get(dominant, "Ausgewogen")

        # === Optimierung: Stunde fuer Stunde ===
        now = datetime.now(timezone.utc)
        result_hourly: list[dict] = []

        # Pass 1: Vorausschau — Preise und PV-Ertrag analysieren
        future_prices = []
        future_pv = []
        for h in range(hours):
            dt = datetime(now.year, now.month, now.day, now.hour, 0, 0, tzinfo=timezone.utc)
            dt = dt + timedelta(hours=h)
            time_str = dt.strftime("%Y-%m-%dT%H:00")

            tariff = self._get_tariff_ct(settings, dt.hour, dt.weekday())
            pv_kw = pv_hourly.get(time_str, {}).get("power_kw", 0)
            future_prices.append(tariff)
            future_pv.append(pv_kw)

        avg_price = sum(future_prices) / max(1, len(future_prices))
        max_pv_hour = max(range(len(future_pv)), key=lambda i: future_pv[i]) if future_pv else 12

        # Gewichtete Strategie-Faktoren
        w_eco = weights.get("economy", 80) / 100.0
        w_sc = weights.get("selfConsumption", 60) / 100.0
        w_gf = weights.get("gridFriendly", 30) / 100.0

        # SOC-Zielwert basierend auf Strategie
        # Hoher Eigenverbrauch → Batterie fuer Abend bereithalten
        # Hohe Wirtschaftlichkeit → Batterie bei niedrigen Preisen laden
        soc_evening_target = 50 + w_sc * 40  # 50-90%

        for h in range(hours):
            dt = datetime(now.year, now.month, now.day, now.hour, 0, 0, tzinfo=timezone.utc)
            dt = dt + timedelta(hours=h)
            time_str = dt.strftime("%Y-%m-%dT%H:00")

            tariff = future_prices[h]
            pv_kw = pv_hourly.get(time_str, {}).get("power_kw", 0)
            load_kw = load_hourly.get(time_str, {}).get("power_kw", 0)
            th = thermal_hourly.get(time_str, {})

            hp_thermal = th.get("hp_thermal_kw", 0)
            hp_electric = th.get("hp_electric_kw", 0)
            boiler_kw = th.get("boiler_kw", 0)
            storage_temp = th.get("storage_temp_c", 50)
            heating_demand = th.get("heating_demand_kw", 0) + th.get("hot_water_kw", 0)
            cop = th.get("hp_cop", 3.5)

            total_electric_load = load_kw + hp_electric
            surplus = pv_kw - total_electric_load

            # === Batterie-Strategie ===
            bat_power = 0.0
            strategy_note = ""

            if bat_capacity_kwh > 0:
                is_cheap_hour = tariff < avg_price * 0.85
                is_expensive_hour = tariff > avg_price * 1.15
                is_pv_producing = pv_kw > 0.5
                is_evening = 17 <= dt.hour <= 22
                soc_low = bat_soc < 30
                soc_high = bat_soc > 80

                if surplus > 0.1:
                    # PV-Ueberschuss → laden
                    charge = min(surplus, bat_max_charge)
                    energy_kwh = charge * bat_charge_eff
                    max_energy = (bat_max_soc - bat_soc) / 100.0 * bat_capacity_kwh
                    if max_energy > 0:
                        charge = min(charge, max_energy / bat_charge_eff)
                        bat_power = charge
                        strategy_note = "PV-Ueberschuss laden"
                    else:
                        strategy_note = "Batterie voll"

                elif surplus < -0.1:
                    deficit = abs(surplus)

                    # Entladen wenn: teurer Strom ODER Abend + Eigenverbrauch priorisiert
                    should_discharge = False
                    if is_expensive_hour and w_eco > 0.3:
                        should_discharge = True
                        strategy_note = "Teure Stunde: Batterie entladen"
                    elif is_evening and w_sc > 0.4 and bat_soc > 40:
                        should_discharge = True
                        strategy_note = "Abend-Eigenverbrauch"
                    elif not is_cheap_hour and bat_soc > bat_min_soc + 10:
                        should_discharge = True
                        strategy_note = "Defizit aus Batterie"

                    if should_discharge and bat_soc > bat_min_soc:
                        discharge = min(deficit, bat_max_discharge)
                        energy_kwh = discharge / bat_discharge_eff
                        max_energy = (bat_soc - bat_min_soc) / 100.0 * bat_capacity_kwh
                        discharge = min(discharge, max_energy * bat_discharge_eff)
                        bat_power = -discharge
                    elif not should_discharge:
                        strategy_note = "Batterie schonen (guenstiger Strom)"

                elif is_cheap_hour and w_eco > 0.5 and bat_soc < soc_evening_target:
                    # Guenstig laden fuer spaeter
                    charge = min(bat_max_charge * 0.5, (soc_evening_target - bat_soc) / 100 * bat_capacity_kwh)
                    if charge > 0.1:
                        bat_power = charge
                        strategy_note = "Guenstig vorladen"

                # SOC aktualisieren
                if bat_power > 0:
                    energy = bat_power * bat_charge_eff
                    bat_soc = min(bat_max_soc, bat_soc + energy / bat_capacity_kwh * 100)
                elif bat_power < 0:
                    energy = abs(bat_power) / bat_discharge_eff
                    bat_soc = max(bat_min_soc, bat_soc - energy / bat_capacity_kwh * 100)

            if not strategy_note:
                strategy_note = "Neutral"

            # === Netz-Bilanz ===
            grid_kw = total_electric_load + bat_power - pv_kw
            # positiv = Bezug, negativ = Einspeisung

            # === Grid-Friendly: Spitzenleistung begrenzen ===
            if w_gf > 0.5 and grid_kw > avg_load * 2 and bat_soc > bat_min_soc + 5:
                # Zu hoher Netzbezug → Batterie zusaetzlich entladen
                extra_discharge = min(
                    grid_kw - avg_load * 1.5,
                    bat_max_discharge - max(0, -bat_power),
                    (bat_soc - bat_min_soc) / 100 * bat_capacity_kwh * bat_discharge_eff,
                )
                if extra_discharge > 0.1:
                    bat_power -= extra_discharge
                    grid_kw -= extra_discharge
                    bat_soc = max(bat_min_soc, bat_soc - extra_discharge / bat_discharge_eff / bat_capacity_kwh * 100)
                    strategy_note += " + Spitzenkappung"

            # === Eigenverbrauch berechnen ===
            self_consumed = min(pv_kw, total_electric_load + max(0, bat_power))
            self_consumption_pct = (self_consumed / pv_kw * 100) if pv_kw > 0.01 else 0

            # === Kosten ===
            cost_ct = 0.0
            if grid_kw > 0:
                cost_ct = grid_kw * tariff / 100.0
            else:
                cost_ct = grid_kw * feed_in_ct / 100.0  # negativ = Einnahme
            cost_ct += boiler_kw * gas_price_ct / 100.0

            # === CO2 ===
            co2_kg = 0.0
            if grid_kw > 0:
                co2_kg += grid_kw * GRID_CO2_KG_PER_KWH
            co2_kg += boiler_kw * GAS_CO2_KG_PER_KWH

            result_hourly.append({
                "time": time_str,
                "pv_forecast_kw": round(pv_kw, 2),
                "load_forecast_kw": round(load_kw, 2),
                "battery_setpoint_kw": round(bat_power, 2),
                "battery_soc_pct": round(bat_soc, 1),
                "hp_thermal_kw": round(hp_thermal, 2),
                "hp_electric_kw": round(hp_electric, 2),
                "hp_cop": round(cop, 2),
                "boiler_kw": round(boiler_kw, 2),
                "storage_temp_c": round(storage_temp, 1),
                "heating_demand_kw": round(heating_demand, 2),
                "grid_kw": round(grid_kw, 2),
                "cost_ct": round(cost_ct, 2),
                "co2_kg": round(co2_kg, 4),
                "self_consumption_pct": round(self_consumption_pct, 1),
                "tariff_ct": round(tariff, 1),
                "strategy": strategy_note,
            })

        # === Zusammenfassung ===
        total_cost = sum(h["cost_ct"] for h in result_hourly if h["cost_ct"] > 0)
        total_revenue = abs(sum(h["cost_ct"] for h in result_hourly if h["cost_ct"] < 0))
        total_co2 = sum(h["co2_kg"] for h in result_hourly)
        sc_hours = [h["self_consumption_pct"] for h in result_hourly if h["pv_forecast_kw"] > 0.01]
        avg_sc = sum(sc_hours) / len(sc_hours) if sc_hours else 0
        peak_import = max((h["grid_kw"] for h in result_hourly), default=0)
        peak_export = abs(min((h["grid_kw"] for h in result_hourly), default=0))
        total_pv = sum(h["pv_forecast_kw"] for h in result_hourly)
        total_import = sum(h["grid_kw"] for h in result_hourly if h["grid_kw"] > 0)
        total_export = abs(sum(h["grid_kw"] for h in result_hourly if h["grid_kw"] < 0))
        total_charged = sum(h["battery_setpoint_kw"] for h in result_hourly if h["battery_setpoint_kw"] > 0)
        total_discharged = abs(sum(h["battery_setpoint_kw"] for h in result_hourly if h["battery_setpoint_kw"] < 0))

        return {
            "generated_at": now.isoformat(),
            "hours": hours,
            "weights": weights,
            "strategy": strategy_name,
            "strategy_description": self._describe_strategy(weights),
            "solver": "heuristic",
            "summary": {
                "total_cost_ct": round(total_cost, 1),
                "total_revenue_ct": round(total_revenue, 1),
                "net_cost_ct": round(total_cost - total_revenue, 1),
                "total_co2_kg": round(total_co2, 2),
                "avg_self_consumption_pct": round(avg_sc, 1),
                "peak_grid_import_kw": round(peak_import, 2),
                "peak_grid_export_kw": round(peak_export, 2),
                "total_pv_kwh": round(total_pv, 1),
                "total_grid_import_kwh": round(total_import, 1),
                "total_grid_export_kwh": round(total_export, 1),
                "total_battery_charged_kwh": round(total_charged, 1),
                "total_battery_discharged_kwh": round(total_discharged, 1),
            },
            "hourly": result_hourly,
        }

    def _describe_strategy(self, weights: dict) -> str:
        """Erzeugt menschenlesbare Strategiebeschreibung."""
        parts = []
        w = weights
        if w.get("economy", 0) >= 70:
            parts.append("Stromkosten minimieren")
        if w.get("co2Reduction", 0) >= 70:
            parts.append("CO2-Emissionen reduzieren")
        if w.get("comfort", 0) >= 70:
            parts.append("Komfort sicherstellen")
        if w.get("selfConsumption", 0) >= 70:
            parts.append("PV-Eigenverbrauch maximieren")
        if w.get("gridFriendly", 0) >= 70:
            parts.append("Netzbelastung glaetten")
        if not parts:
            return "Ausgewogene Optimierung ueber alle Kriterien."
        return "Prioritaeten: " + ", ".join(parts) + "."


# Singleton
energy_optimizer = EnergyOptimizer()
