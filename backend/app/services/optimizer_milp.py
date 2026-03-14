"""
MILP-Optimierer — Mathematisch optimale Einsatzplanung mit PuLP/CBC.

Formuliert das Energiemanagement als lineares Programm:
- Entscheidungsvariablen: Batterie, Netz, WP, Kessel pro Stunde
- Nebenbedingungen: Energiebilanz, SOC-Grenzen, Speichertemperatur
- Zielfunktion: Gewichtete Summe (Kosten, CO2, Komfort, Eigenverbrauch, Netzdienlich)

Loesungszeit: <1s fuer 24h, <3s fuer 72h (auch auf Raspberry Pi 5).
"""

import logging
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# CO2-Faktoren (kg/kWh)
GRID_CO2 = 0.400
GAS_CO2 = 0.202

# Komfort-Strafkosten (hoher Wert = starker Anreiz, Bedarf zu decken)
M_COMFORT = 50.0


@dataclass
class CircuitMilpParams:
    """Pro-Kreis Parameter fuer den MILP-Solver."""
    circuit_id: str = ""
    circuit_name: str = ""
    distribution_type: str = "radiator"
    design_flow_temp_c: float = 55.0
    min_flow_temp_c: float = 20.0
    max_flow_temp_c: float = 65.0
    demand_kw: list[float] = field(default_factory=list)  # Pro Stunde
    optimal_flow_temp_c: list[float] = field(default_factory=list)  # Pro Stunde
    tau_response_h: float = 0.5


@dataclass
class MilpParams:
    """Alle Eingabedaten fuer den MILP-Solver."""
    hours: int = 24
    # Prognosen (pro Stunde)
    pv_kw: list[float] = field(default_factory=list)
    load_kw: list[float] = field(default_factory=list)
    thermal_demand_kw: list[float] = field(default_factory=list)
    cop: list[float] = field(default_factory=list)
    tariff_ct: list[float] = field(default_factory=list)
    # Tarif
    feed_in_ct: float = 8.2
    gas_price_ct: float = 8.0
    # Batterie
    bat_capacity_kwh: float = 0.0
    bat_max_charge_kw: float = 0.0
    bat_max_discharge_kw: float = 0.0
    bat_soc_min_pct: float = 10.0
    bat_soc_max_pct: float = 95.0
    bat_soc_initial_pct: float = 50.0
    bat_eta_charge: float = 0.95
    bat_eta_discharge: float = 0.95
    # Waermepumpe
    hp_max_thermal_kw: float = 0.0
    # Kessel
    boiler_max_kw: float = 0.0
    # Waermespeicher
    storage_capacity_kwh_per_k: float = 1.7
    storage_temp_min: float = 30.0
    storage_temp_max: float = 80.0
    storage_temp_initial: float = 55.0
    storage_temp_target: float = 55.0
    storage_loss_w_per_k: float = 2.0
    # Pro-Kreis Daten (optional — ohne Kreise laeuft bestehende Formulierung)
    circuits: list[CircuitMilpParams] = field(default_factory=list)
    # Optimierer-Gewichte (0-100)
    w_economy: float = 80.0
    w_co2: float = 50.0
    w_comfort: float = 70.0
    w_self_consumption: float = 60.0
    w_grid_friendly: float = 30.0


@dataclass
class CircuitMilpResult:
    """Pro-Kreis Ergebnis des MILP-Solvers."""
    circuit_id: str = ""
    flow_temp_c: list[float] = field(default_factory=list)  # Pro Stunde
    demand_kw: list[float] = field(default_factory=list)


@dataclass
class MilpResult:
    """Ergebnis des MILP-Solvers."""
    status: str = ""
    solve_time_ms: float = 0.0
    # Pro Stunde
    bat_charge_kw: list[float] = field(default_factory=list)
    bat_discharge_kw: list[float] = field(default_factory=list)
    soc_pct: list[float] = field(default_factory=list)
    grid_import_kw: list[float] = field(default_factory=list)
    grid_export_kw: list[float] = field(default_factory=list)
    hp_thermal_kw: list[float] = field(default_factory=list)
    boiler_kw: list[float] = field(default_factory=list)
    storage_temp_c: list[float] = field(default_factory=list)
    # Pro-Kreis Ergebnisse
    circuit_results: list[CircuitMilpResult] = field(default_factory=list)


def solve_milp(params: MilpParams) -> MilpResult | None:
    """
    Formuliert und loest das MILP-Problem.

    Returns: MilpResult oder None bei Fehler (Fallback auf Heuristik).
    """
    try:
        import pulp
    except ImportError:
        logger.warning("PuLP nicht installiert — MILP nicht verfuegbar")
        return None

    start = time.monotonic()
    T = params.hours

    # Sicherheitscheck
    if T == 0 or not params.pv_kw:
        return None

    prob = pulp.LpProblem("EnergySchedule", pulp.LpMinimize)

    # === Entscheidungsvariablen ===

    bat_ch = [pulp.LpVariable(f"bch_{t}", 0, params.bat_max_charge_kw) for t in range(T)]
    bat_dis = [pulp.LpVariable(f"bdis_{t}", 0, params.bat_max_discharge_kw) for t in range(T)]

    # SOC in kWh (T+1 Werte: Anfangs- + Endzustand pro Stunde)
    soc_min_kwh = params.bat_soc_min_pct / 100 * params.bat_capacity_kwh
    soc_max_kwh = params.bat_soc_max_pct / 100 * params.bat_capacity_kwh
    soc_init_kwh = params.bat_soc_initial_pct / 100 * params.bat_capacity_kwh

    if params.bat_capacity_kwh > 0:
        soc = [pulp.LpVariable(f"soc_{t}", soc_min_kwh, soc_max_kwh) for t in range(T + 1)]
    else:
        soc = [pulp.LpVariable(f"soc_{t}", 0, 0) for t in range(T + 1)]

    grid_imp = [pulp.LpVariable(f"gimp_{t}", 0) for t in range(T)]
    grid_exp = [pulp.LpVariable(f"gexp_{t}", 0) for t in range(T)]

    hp = [pulp.LpVariable(f"hp_{t}", 0, params.hp_max_thermal_kw) for t in range(T)]
    boiler = [pulp.LpVariable(f"boil_{t}", 0, params.boiler_max_kw) for t in range(T)]

    t_stor = [pulp.LpVariable(f"ts_{t}", params.storage_temp_min, params.storage_temp_max) for t in range(T + 1)]

    therm_deficit = [pulp.LpVariable(f"td_{t}", 0) for t in range(T)]
    peak_grid = pulp.LpVariable("peak", 0)

    # === Nebenbedingungen ===

    # Anfangsbedingungen
    prob += soc[0] == soc_init_kwh, "soc_init"
    prob += t_stor[0] == params.storage_temp_initial, "tstor_init"

    for t in range(T):
        cop_t = max(1.5, params.cop[t]) if t < len(params.cop) else 3.5
        hp_elec_coeff = 1.0 / cop_t  # Linear: hp_elec = hp[t] * (1/COP)

        pv_t = params.pv_kw[t] if t < len(params.pv_kw) else 0
        load_t = params.load_kw[t] if t < len(params.load_kw) else 0
        demand_t = params.thermal_demand_kw[t] if t < len(params.thermal_demand_kw) else 0

        # Elektrische Energiebilanz
        prob += (
            pv_t + grid_imp[t] + bat_dis[t]
            == load_t + hp[t] * hp_elec_coeff + bat_ch[t] + grid_exp[t]
        ), f"elec_bal_{t}"

        # SOC-Dynamik
        prob += (
            soc[t + 1] == soc[t]
            + bat_ch[t] * params.bat_eta_charge
            - bat_dis[t] / max(0.5, params.bat_eta_discharge)
        ), f"soc_dyn_{t}"

        # Thermische Bilanz (Soft-Constraint mit Slack)
        prob += (
            hp[t] + boiler[t] + therm_deficit[t] >= demand_t
        ), f"therm_bal_{t}"

        # Speichertemperatur-Dynamik (linearisierte Verluste)
        avg_loss_kw = params.storage_loss_w_per_k * max(0, params.storage_temp_target - 20) / 1000.0
        if params.storage_capacity_kwh_per_k > 0:
            prob += (
                t_stor[t + 1] == t_stor[t]
                + (hp[t] + boiler[t] - demand_t - avg_loss_kw)
                / params.storage_capacity_kwh_per_k
            ), f"tstor_dyn_{t}"

        # Peak-Tracking
        prob += peak_grid >= grid_imp[t], f"peak_{t}"

    # === Pro-Kreis Variablen und Constraints ===
    circuit_flow_vars: dict[str, list] = {}
    circuit_demand_vars: dict[str, list[float]] = {}

    if params.circuits:
        for ci, cparams in enumerate(params.circuits):
            cid = cparams.circuit_id
            # Vorlauftemperatur als Entscheidungsvariable pro Stunde
            flow_vars = [
                pulp.LpVariable(
                    f"ft_{ci}_{t}",
                    cparams.min_flow_temp_c,
                    cparams.max_flow_temp_c,
                )
                for t in range(T)
            ]
            circuit_flow_vars[cid] = flow_vars

            # Demand pro Stunde aus Forecast
            c_demand = cparams.demand_kw if len(cparams.demand_kw) >= T else (
                cparams.demand_kw + [0.0] * (T - len(cparams.demand_kw))
            )
            circuit_demand_vars[cid] = c_demand

            for t in range(T):
                # Vorlauftemp mindestens so hoch wie optimal (Soft-Constraint)
                opt_ft = (cparams.optimal_flow_temp_c[t]
                          if t < len(cparams.optimal_flow_temp_c) else cparams.design_flow_temp_c)
                # Weiche Untergrenze: Vorlauftemp soll nahe optimal sein
                prob += flow_vars[t] >= opt_ft - 3.0, f"ft_min_{ci}_{t}"

        # Aggregierte Thermal-Demand muss von WP+Kessel gedeckt werden
        for t in range(T):
            total_circuit_demand = sum(
                circuit_demand_vars[cp.circuit_id][t]
                for cp in params.circuits
                if cp.circuit_id in circuit_demand_vars
            )
            if total_circuit_demand > 0.01:
                prob += (
                    hp[t] + boiler[t] + therm_deficit[t] >= total_circuit_demand
                ), f"circuit_therm_{t}"

        # COP-Kopplung: Niedrigere Vorlauftemp verbessert COP
        # Linearisierter Bonus: fuer jeden Grad unter 55°C, 1.5% besser
        # Implementiert als Kostenbonus in der Zielfunktion (s.u.)

    # === Zielfunktion ===

    # Normalisierungsfaktoren (basierend auf typischen Groessenordnungen)
    avg_tariff = sum(params.tariff_ct) / max(1, len(params.tariff_ct))
    avg_load = sum(params.load_kw) / max(1, len(params.load_kw))

    scale_eco = max(1, avg_tariff * max(1, avg_load) * T / 100)
    scale_co2 = max(0.1, GRID_CO2 * max(1, avg_load) * T)
    scale_sc = max(1, avg_load * T)
    scale_gf = max(1, avg_load * T)

    # Gewichte normalisieren (0-100 -> 0-1)
    w_eco = params.w_economy / 100.0
    w_co2 = params.w_co2 / 100.0
    w_comf = params.w_comfort / 100.0
    w_sc = params.w_self_consumption / 100.0
    w_gf = params.w_grid_friendly / 100.0

    # Kosten-Term
    cost_term = pulp.lpSum(
        grid_imp[t] * (params.tariff_ct[t] if t < len(params.tariff_ct) else avg_tariff) / 100.0
        - grid_exp[t] * params.feed_in_ct / 100.0
        + boiler[t] * params.gas_price_ct / 100.0
        for t in range(T)
    )

    # CO2-Term
    co2_term = pulp.lpSum(
        grid_imp[t] * GRID_CO2 + boiler[t] * GAS_CO2
        for t in range(T)
    )

    # Komfort-Term (Strafe fuer thermisches Defizit)
    comfort_term = pulp.lpSum(therm_deficit[t] * M_COMFORT for t in range(T))

    # Eigenverbrauch-Term (Netzbezug minimieren = Eigenverbrauch maximieren)
    self_cons_term = pulp.lpSum(grid_imp[t] for t in range(T))

    # Netzdienlichkeits-Term (Spitzenlast minimieren)
    grid_friendly_term = peak_grid * T

    # COP-Bonus fuer niedrige Vorlauftemperaturen (je niedriger, desto effizienter)
    cop_bonus_term = 0
    if params.circuits and circuit_flow_vars:
        # Bonus: Niedrige Vorlauftemp reduziert Stromverbrauch
        # Linearisiert: 0.001 pro Grad unter 55°C pro Stunde
        cop_bonus_term = pulp.lpSum(
            flow_vars[t] * 0.001
            for flow_vars in circuit_flow_vars.values()
            for t in range(T)
        )

    # Gewichtete Zielfunktion
    prob += (
        w_eco * cost_term / scale_eco
        + w_co2 * co2_term / scale_co2
        + w_comf * comfort_term
        + w_sc * self_cons_term / scale_sc
        + w_gf * grid_friendly_term / scale_gf
        + w_eco * cop_bonus_term
    ), "objective"

    # === Loesen ===
    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=4)
    prob.solve(solver)

    elapsed_ms = (time.monotonic() - start) * 1000
    status = pulp.LpStatus[prob.status]

    if status != "Optimal":
        logger.warning("MILP nicht optimal: %s (%.0fms)", status, elapsed_ms)
        return None

    # === Ergebnis extrahieren ===
    result = MilpResult(
        status=status,
        solve_time_ms=round(elapsed_ms, 1),
    )

    for t in range(T):
        result.bat_charge_kw.append(round(pulp.value(bat_ch[t]) or 0, 2))
        result.bat_discharge_kw.append(round(pulp.value(bat_dis[t]) or 0, 2))
        result.grid_import_kw.append(round(pulp.value(grid_imp[t]) or 0, 2))
        result.grid_export_kw.append(round(pulp.value(grid_exp[t]) or 0, 2))
        result.hp_thermal_kw.append(round(pulp.value(hp[t]) or 0, 2))
        result.boiler_kw.append(round(pulp.value(boiler[t]) or 0, 2))

    for t in range(T + 1):
        soc_kwh = pulp.value(soc[t]) or 0
        soc_pct = soc_kwh / params.bat_capacity_kwh * 100 if params.bat_capacity_kwh > 0 else 0
        result.soc_pct.append(round(soc_pct, 1))

        result.storage_temp_c.append(round(pulp.value(t_stor[t]) or params.storage_temp_initial, 1))

    # Pro-Kreis Ergebnisse extrahieren
    if params.circuits and circuit_flow_vars:
        for cparams in params.circuits:
            cid = cparams.circuit_id
            flow_vars = circuit_flow_vars.get(cid, [])
            c_demand = circuit_demand_vars.get(cid, [])

            cr = CircuitMilpResult(circuit_id=cid)
            for t in range(T):
                if t < len(flow_vars):
                    cr.flow_temp_c.append(round(pulp.value(flow_vars[t]) or cparams.design_flow_temp_c, 1))
                else:
                    cr.flow_temp_c.append(cparams.design_flow_temp_c)
                cr.demand_kw.append(round(c_demand[t] if t < len(c_demand) else 0, 2))

            result.circuit_results.append(cr)

    logger.info(
        "MILP geloest: %s in %.0fms, Obj=%.2f",
        status, elapsed_ms, pulp.value(prob.objective) or 0,
    )
    return result
