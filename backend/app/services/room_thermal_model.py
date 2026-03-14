"""
Raum-Thermik-Modell — RC-Modell 1. Ordnung pro Raum.

Berechnet Raumtemperatur-Entwicklung und Heizkreis-Waermebedarf
basierend auf:
- Thermischer Traegheit (tau_response: FBH ~2.5h, Radiator ~0.4h)
- Gebaeudehuelle (tau_loss: 20-80h je nach Daemmung/Raumgroesse)
- Vorlauftemperatur und Aussentemperatur

Formel:
  T_room(t+dt) = T_room(t)
    + dt/tau_response * (T_supply_eff - T_room(t))
    - dt/tau_loss * (T_room(t) - T_outdoor(t))
    + Q_gains * dt / C_room
"""

import logging
import math
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Default-Zeitkonstanten pro Verteilsystem (Stunden)
TAU_RESPONSE_DEFAULTS = {
    "floor_heating": 2.5,      # FBH: traege (Estrich-Masse)
    "radiator": 0.4,           # Heizkoerper: schnell
    "fan_coil": 0.15,          # Geblaese-Konvektor: sehr schnell
    "ceiling_cooling": 1.5,    # Kuehldecke: mittel
    "mixed": 1.0,              # Gemischt (z.B. WW-Bereitung)
}

# Default Gebaeude-Zeitkonstante (Stunden) — je nach Daemmung
TAU_LOSS_DEFAULTS = {
    "poor": 25.0,       # Altbau unsaniert
    "average": 40.0,    # Teilsaniert
    "good": 60.0,       # EnEV/GEG Standard
    "passive_house": 100.0,
}

# Interne Waermegewinne (W/m2) — Personen, Geraete, Beleuchtung
INTERNAL_GAINS_W_M2 = {
    "wohnen": 5.0,
    "buero": 8.0,
    "gewerbe": 10.0,
    "flur": 2.0,
    "technik": 15.0,    # Geraeteabwaerme
    "lager": 0.0,
}


@dataclass
class RoomThermalParams:
    """Thermische Parameter eines Raums."""
    room_id: str = ""
    room_name: str = ""
    area_m2: float = 50.0
    volume_m3: float = 125.0
    circuit_id: str = ""
    circuit_type: str = "radiator"     # floor_heating, radiator, fan_coil, ...
    target_temp_c: float = 21.0
    night_setback_k: float = 3.0
    min_temp_c: float = 16.0
    max_temp_c: float = 26.0
    tau_response_h: float = 0.4        # Traegheit Waermeabgabe
    tau_loss_h: float = 40.0           # Gebaeudehuelle-Zeitkonstante
    u_value_room: float = 1.0          # spez. Waermeverlust W/(m2*K)
    internal_gains_w_m2: float = 5.0   # Interne Waermegewinne
    schedule: list = field(default_factory=list)  # Heizplan


@dataclass
class RoomThermalState:
    """Aktueller thermischer Zustand eines Raums."""
    room_id: str = ""
    room_name: str = ""
    temperature_c: float = 20.0
    target_temp_c: float = 21.0
    heating_demand_kw: float = 0.0
    circuit_id: str = ""
    circuit_type: str = "radiator"


def get_default_params(room: dict, circuit: dict | None, insulation: str = "good") -> RoomThermalParams:
    """
    Erzeugt Default-Parameter fuer einen Raum basierend auf Raum- und Kreis-Konfiguration.

    Args:
        room: Raum-Dict aus RoomConfig.data
        circuit: Heizkreis-Dict aus CircuitConfig.data (oder None)
        insulation: Daemmstandard aus SystemSettings
    """
    area = room.get("areaM2", 50)
    height = room.get("heightM", 2.5)
    volume = area * height
    room_type = room.get("roomType", "wohnen")

    circuit_type = "radiator"
    circuit_id = room.get("heatingCircuitId", "")
    if circuit:
        circuit_type = circuit.get("distributionType", "radiator")
        circuit_id = circuit.get("id", circuit_id)

    tau_response = TAU_RESPONSE_DEFAULTS.get(circuit_type, 0.5)
    tau_loss = TAU_LOSS_DEFAULTS.get(insulation, 40.0)

    # Groessere Raeume haben laengere Verlust-Zeitkonstante (mehr Masse)
    tau_loss *= min(2.0, max(0.7, volume / 150.0))

    u_value = {
        "poor": 1.8, "average": 1.0, "good": 0.5, "passive_house": 0.15
    }.get(insulation, 1.0)

    gains = INTERNAL_GAINS_W_M2.get(room_type, 5.0)

    return RoomThermalParams(
        room_id=room.get("id", ""),
        room_name=room.get("name", ""),
        area_m2=area,
        volume_m3=volume,
        circuit_id=circuit_id,
        circuit_type=circuit_type,
        target_temp_c=room.get("targetTemperatureC", 21),
        night_setback_k=room.get("nightSetbackK", 3),
        min_temp_c=room.get("minTemperatureC", 16),
        max_temp_c=room.get("maxTemperatureC", 26),
        tau_response_h=tau_response,
        tau_loss_h=tau_loss,
        u_value_room=u_value,
        internal_gains_w_m2=gains,
        schedule=room.get("schedule", []),
    )


def step_room_temperature(
    params: RoomThermalParams,
    t_current: float,
    t_outdoor: float,
    t_flow: float,
    dt_h: float,
) -> float:
    """
    RC-Modell: Berechnet neue Raumtemperatur nach dt Stunden.

    T_new = T_cur
        + dt/tau_response * (T_flow_eff - T_cur)
        - dt/tau_loss * (T_cur - T_outdoor)
        + Q_gains * dt / C_room

    Args:
        params: Raum-Parameter
        t_current: Aktuelle Raumtemperatur [degC]
        t_outdoor: Aussentemperatur [degC]
        t_flow: Vorlauftemperatur des Kreises [degC]
        dt_h: Zeitschritt [Stunden]

    Returns:
        Neue Raumtemperatur [degC]
    """
    tau_r = max(0.05, params.tau_response_h)
    tau_l = max(1.0, params.tau_loss_h)

    # Effektive Zufuhr-Temperatur: Nur wenn Vorlauf > Raum (Heizen)
    if t_flow > t_current:
        t_supply_eff = t_flow
    else:
        t_supply_eff = t_current  # Kein Waermeeintrag

    # Waermegewinn durch interne Quellen
    c_room_kwh_per_k = params.volume_m3 * 0.34 / 1000.0  # Luft: 0.34 Wh/(m3*K)
    c_room_kwh_per_k += params.area_m2 * 50.0 / 1000.0   # Baumasse: ~50 Wh/(m2*K)
    c_room_kwh_per_k = max(0.1, c_room_kwh_per_k)

    q_gains_kw = params.internal_gains_w_m2 * params.area_m2 / 1000.0

    # RC-Modell Schritt
    delta_heating = dt_h / tau_r * (t_supply_eff - t_current)
    delta_loss = dt_h / tau_l * (t_current - t_outdoor)
    delta_gains = q_gains_kw * dt_h / c_room_kwh_per_k

    t_new = t_current + delta_heating - delta_loss + delta_gains

    # Physikalische Grenzen
    t_new = max(t_outdoor - 2.0, min(t_flow + 2.0, t_new))

    return t_new


def calculate_room_heating_demand(
    params: RoomThermalParams,
    t_current: float,
    t_outdoor: float,
    t_target: float,
) -> float:
    """
    Berechnet den aktuellen Waermebedarf eines Raums [kW].

    Basiert auf stationaerem Ansatz + Aufheizanteil.
    """
    # Transmissionsverlust
    q_loss = params.u_value_room * params.area_m2 * max(0, t_target - t_outdoor) / 1000.0

    # Aufheizanteil wenn unter Solltemperatur
    delta = t_target - t_current
    if delta > 0.2:
        c_room = max(0.1, params.volume_m3 * 0.34 / 1000.0 + params.area_m2 * 50.0 / 1000.0)
        q_reheat = delta * c_room / max(0.5, params.tau_response_h)
    else:
        q_reheat = 0.0

    # Interne Gewinne abziehen
    q_gains = params.internal_gains_w_m2 * params.area_m2 / 1000.0
    demand = max(0, q_loss + q_reheat - q_gains)

    return demand


def calculate_circuit_demand(
    rooms_params: list[RoomThermalParams],
    rooms_temps: dict[str, float],
    outdoor_temp: float,
    targets: dict[str, float],
) -> float:
    """
    Aggregierter Waermebedarf aller Raeume eines Kreises [kW].
    """
    total = 0.0
    for params in rooms_params:
        t_cur = rooms_temps.get(params.room_id, params.target_temp_c)
        t_target = targets.get(params.room_id, params.target_temp_c)
        total += calculate_room_heating_demand(params, t_cur, outdoor_temp, t_target)
    return total


def calculate_optimal_flow_temp(
    rooms_params: list[RoomThermalParams],
    rooms_temps: dict[str, float],
    outdoor_temp: float,
    targets: dict[str, float],
    design_outdoor_c: float = -12.0,
    design_flow_c: float = 55.0,
) -> float:
    """
    Minimale Vorlauftemperatur die alle Raeume auf Sollwert bringt.

    Basiert auf Heizkurve pro Raum, nimmt das Maximum.
    """
    max_flow = outdoor_temp  # Mindestens Aussentemp

    for params in rooms_params:
        t_target = targets.get(params.room_id, params.target_temp_c)
        t_current = rooms_temps.get(params.room_id, t_target)

        if outdoor_temp >= t_target:
            continue

        # Basis-Heizkurve
        ratio = (t_target - outdoor_temp) / max(1, t_target - design_outdoor_c)
        ratio = max(0, min(1.5, ratio))

        # Vorlauftemp fuer diesen Raum
        flow = t_target + (design_flow_c - t_target) * ratio

        # Aufheiz-Zuschlag wenn unter Soll
        delta = t_target - t_current
        if delta > 0.5:
            flow += min(5.0, delta * 2.0)

        max_flow = max(max_flow, flow)

    return min(75.0, max(20.0, max_flow))


def calculate_preheat_start(
    params: RoomThermalParams,
    t_current: float,
    t_target: float,
    t_outdoor: float,
    t_flow: float = 45.0,
) -> float:
    """
    Berechnet erforderliche Vorheizzeit [Stunden].

    Basierend auf gelerntem tau: t_pre = tau * ln((T_flow - T_ist) / (T_flow - T_soll))
    """
    if t_current >= t_target - 0.3:
        return 0.0

    if t_flow <= t_current:
        return params.tau_response_h * 3.0  # Keine Heizung moeglich, max Vorheizzeit

    delta_start = t_flow - t_current
    delta_end = t_flow - t_target

    if delta_end <= 0:
        delta_end = 0.5

    if delta_start <= delta_end:
        return 0.0

    t_pre = params.tau_response_h * math.log(delta_start / delta_end)

    # Sicherheitszuschlag (50%)
    t_pre *= 1.5

    return min(t_pre, params.tau_response_h * 4.0)


def get_room_target_at_time(schedule: list[dict], hour: float, weekday: int, default_target: float) -> float:
    """
    Bestimmt die Soll-Temperatur eines Raums zu einem bestimmten Zeitpunkt
    basierend auf dem Heizplan (Schedule).
    """
    if not schedule:
        return default_target

    day_names = ["mo", "di", "mi", "do", "fr", "sa", "so"]
    current_day = day_names[weekday] if weekday < 7 else "mo"

    time_str = f"{int(hour):02d}:{int((hour % 1) * 60):02d}"

    for entry in schedule:
        days = entry.get("days", [])
        if current_day not in [d.lower() for d in days]:
            continue

        start_time = entry.get("startTime", "00:00")
        end_time = entry.get("endTime", "24:00")

        if start_time <= time_str < end_time:
            return entry.get("targetTemperatureC", default_target)

    # Ausserhalb aller Schedule-Eintraege: Nachtabsenkung
    return default_target
