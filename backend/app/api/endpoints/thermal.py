"""
Thermal API — Pro-Raum Thermik-Status und gelernte Parameter.

Endpoints:
  GET  /thermal/rooms           — Pro-Raum Thermik-Status
  GET  /thermal/circuits        — Pro-Kreis Status + Setpoints
  GET  /thermal/learned-params  — Gelernte Parameter (tau, Kurven)
  POST /thermal/learn           — Manuell Lernen triggern
"""

import logging

from fastapi import APIRouter

from app.services.room_thermal_model import (
    RoomThermalState,
    calculate_circuit_demand,
    calculate_optimal_flow_temp,
    get_default_params,
    get_room_target_at_time,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/rooms")
async def get_room_thermal_status():
    """Pro-Raum Thermik-Status: aktuelle Temperatur, Sollwert, Bedarf."""
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.core.database import async_session
    from app.models.config import CircuitConfig, RoomConfig, SystemSettingsConfig
    from app.models.thermal_params import ThermalLearnedParams

    async with async_session() as db:
        room_r = await db.execute(select(RoomConfig))
        rooms = [r.data for r in room_r.scalars()]

        circuit_r = await db.execute(select(CircuitConfig))
        circuits_list = [r.data for r in circuit_r.scalars()]
        circuits_map = {c["id"]: c for c in circuits_list}

        settings_r = await db.execute(select(SystemSettingsConfig))
        row = settings_r.scalar_one_or_none()
        settings = row.data if row else {}

        learned_r = await db.execute(select(ThermalLearnedParams))
        learned_map = {r.id: r.data for r in learned_r.scalars()}

    # Simulator-Raumtemperaturen lesen
    try:
        from app.services.simulator import simulator
        room_temps = getattr(simulator._state, "room_temperatures", {})
    except Exception:
        room_temps = {}

    insulation = settings.get("insulationStandard", "good")
    now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0
    weekday = now.weekday()

    result = []
    for room in rooms:
        room_id = room.get("id", "")
        circuit_id = room.get("heatingCircuitId", "")
        circuit = circuits_map.get(circuit_id)

        params = get_default_params(room, circuit, insulation)

        # Gelernte Parameter uebernehmen
        learned = learned_map.get(room_id, {})
        if learned:
            params.tau_response_h = learned.get("tau_response_h", params.tau_response_h)
            params.tau_loss_h = learned.get("tau_loss_h", params.tau_loss_h)

        target = get_room_target_at_time(params.schedule, hour, weekday, params.target_temp_c)
        current_temp = room_temps.get(room_id, target)

        result.append({
            "room_id": room_id,
            "room_name": room.get("name", ""),
            "temperature_c": round(current_temp, 1),
            "target_temp_c": round(target, 1),
            "circuit_id": circuit_id,
            "circuit_type": params.circuit_type,
            "tau_response_h": params.tau_response_h,
            "tau_loss_h": params.tau_loss_h,
            "has_learned_params": bool(learned),
        })

    return {"rooms": result}


@router.get("/circuits")
async def get_circuit_thermal_status():
    """Pro-Kreis Status: aggregierter Bedarf, optimale Vorlauftemp."""
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.core.database import async_session
    from app.models.config import CircuitConfig, RoomConfig, SystemSettingsConfig
    from app.models.thermal_params import ThermalLearnedParams

    async with async_session() as db:
        room_r = await db.execute(select(RoomConfig))
        rooms = [r.data for r in room_r.scalars()]

        circuit_r = await db.execute(select(CircuitConfig))
        circuits_list = [r.data for r in circuit_r.scalars()]

        settings_r = await db.execute(select(SystemSettingsConfig))
        row = settings_r.scalar_one_or_none()
        settings = row.data if row else {}

        learned_r = await db.execute(select(ThermalLearnedParams))
        learned_map = {r.id: r.data for r in learned_r.scalars()}

    # Simulator-State
    try:
        from app.services.simulator import simulator
        room_temps = getattr(simulator._state, "room_temperatures", {})
        outdoor_temp = simulator._state.outdoor_temp_c
    except Exception:
        room_temps = {}
        outdoor_temp = 5.0

    insulation = settings.get("insulationStandard", "good")
    now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0
    weekday = now.weekday()

    # Raeume nach Kreisen gruppieren
    circuits_map = {c["id"]: c for c in circuits_list}
    circuit_rooms: dict[str, list] = {}
    for room in rooms:
        cid = room.get("heatingCircuitId", "")
        if cid:
            circuit_rooms.setdefault(cid, []).append(room)

    result = []
    for circuit in circuits_list:
        cid = circuit.get("id", "")
        c_rooms = circuit_rooms.get(cid, [])

        params_list = []
        targets = {}
        temps = {}
        for room in c_rooms:
            rid = room.get("id", "")
            params = get_default_params(room, circuit, insulation)
            learned = learned_map.get(rid, {})
            if learned:
                params.tau_response_h = learned.get("tau_response_h", params.tau_response_h)
                params.tau_loss_h = learned.get("tau_loss_h", params.tau_loss_h)
            params_list.append(params)
            targets[rid] = get_room_target_at_time(params.schedule, hour, weekday, params.target_temp_c)
            temps[rid] = room_temps.get(rid, targets[rid])

        demand_kw = calculate_circuit_demand(params_list, temps, outdoor_temp, targets)
        opt_flow = calculate_optimal_flow_temp(
            params_list, temps, outdoor_temp, targets,
            circuit.get("designOutdoorTemperatureC", -12),
            circuit.get("flowTemperatureC", 55),
        )

        result.append({
            "circuit_id": cid,
            "circuit_name": circuit.get("name", ""),
            "distribution_type": circuit.get("distributionType", "radiator"),
            "room_count": len(c_rooms),
            "thermal_demand_kw": round(demand_kw, 2),
            "optimal_flow_temp_c": round(opt_flow, 1),
            "design_flow_temp_c": circuit.get("flowTemperatureC", 55),
            "outdoor_temp_c": round(outdoor_temp, 1),
        })

    return {"circuits": result}


@router.get("/learned-params")
async def get_learned_params():
    """Gelernte thermische Parameter aller Raeume."""
    from app.services.ml.thermal_learner import thermal_learner
    params = await thermal_learner.get_learned_params()
    return {"params": params, "count": len(params)}


@router.post("/learn")
async def trigger_learning(days_back: int = 28):
    """Manuell Lernen triggern."""
    from app.services.ml.thermal_learner import thermal_learner

    results = await thermal_learner.learn_all(days_back)

    success_count = sum(1 for r in results.values() if r.get("success"))
    return {
        "total_rooms": len(results),
        "successful": success_count,
        "results": results,
    }
