"""Lademanagement — steuert Wallboxen und Ladesessions."""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charging import ChargingMode, ChargingSession, SessionStatus, Vehicle, Wallbox
from app.models.config import ConsumerConfig


class ChargingManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_charging_power(
        self, session: ChargingSession, surplus_kw: float
    ) -> float:
        """Berechne die Ladeleistung basierend auf Modus."""
        wallbox = await self.db.get(Wallbox, session.wallbox_id)
        if not wallbox:
            return 0.0

        if session.mode == ChargingMode.MAX_SPEED.value:
            return wallbox.max_power_kw

        elif session.mode == ChargingMode.PV_SURPLUS.value:
            return self._pv_surplus_power(wallbox, surplus_kw)

        elif session.mode == ChargingMode.MIN_PV.value:
            return self._min_pv_power(wallbox, surplus_kw)

        elif session.mode == ChargingMode.TARGET_CHARGE.value:
            return self._target_charge_power(session, wallbox, surplus_kw)

        return 0.0

    def _pv_surplus_power(self, wallbox: Wallbox, surplus_kw: float) -> float:
        """Modus 2: Nur laden wenn PV-Überschuss vorhanden."""
        if surplus_kw < wallbox.min_power_kw:
            return 0.0
        return min(surplus_kw, wallbox.max_power_kw)

    def _min_pv_power(self, wallbox: Wallbox, surplus_kw: float) -> float:
        """Modus 3: Mindestleistung + PV-Boost.

        Lädt immer mit Mindestleistung (kein Start/Stop-Zyklus).
        Bei PV-Überschuss wird die Leistung erhöht.
        """
        base_power = wallbox.min_power_kw
        if surplus_kw > base_power:
            return min(surplus_kw, wallbox.max_power_kw)
        return base_power

    def _target_charge_power(
        self, session: ChargingSession, wallbox: Wallbox, surplus_kw: float
    ) -> float:
        """Modus 4: Zielladung+PV-Überschuss berechnen."""
        if not session.target_energy_kwh or not session.target_time:
            return 0.0

        remaining_kwh = session.target_energy_kwh - session.energy_charged_kwh
        if remaining_kwh <= 0:
            return 0.0

        now = datetime.now(timezone.utc)
        remaining_hours = (session.target_time - now).total_seconds() / 3600
        if remaining_hours <= 0:
            return wallbox.max_power_kw  # Deadline erreicht, sofort laden

        required_power_kw = remaining_kwh / remaining_hours

        # Wenn Überschuss vorhanden, nutze diesen
        if surplus_kw >= wallbox.min_power_kw:
            return min(max(surplus_kw, required_power_kw), wallbox.max_power_kw)

        # Wenn benötigte Leistung hoch genug, muss Netzstrom genutzt werden
        if required_power_kw >= wallbox.min_power_kw:
            return min(required_power_kw, wallbox.max_power_kw)

        # Noch genug Zeit, warte auf Überschuss
        return 0.0

    async def update_session_energy(
        self, session: ChargingSession, power_kw: float, duration_hours: float,
        surplus_kw: float = 0.0, grid_price_ct_per_kwh: float = 30.0,
    ) -> None:
        """Aktualisiere geladene Energie mit Solar/Grid-Aufschlüsselung."""
        session.current_power_kw = power_kw
        energy_kwh = power_kw * duration_hours
        session.energy_charged_kwh += energy_kwh

        # Solar vs Grid aufschlüsseln
        solar_kw = min(max(0.0, surplus_kw), power_kw)
        grid_kw = power_kw - solar_kw
        session.solar_energy_kwh += solar_kw * duration_hours
        session.grid_energy_kwh += grid_kw * duration_hours
        session.cost_ct += grid_kw * duration_hours * grid_price_ct_per_kwh

        # SoC aktualisieren wenn Batterie bekannt
        if session.vehicle_battery_capacity_kwh and session.vehicle_battery_capacity_kwh > 0:
            soc_delta = (energy_kwh / session.vehicle_battery_capacity_kwh) * 100
            current_soc = session.vehicle_soc_pct or 0.0
            session.vehicle_soc_pct = min(100.0, current_soc + soc_delta)

            # SoC-Limit prüfen
            if session.soc_limit_pct and session.vehicle_soc_pct >= session.soc_limit_pct:
                session.status = SessionStatus.COMPLETED.value
                session.completed_at = datetime.now(timezone.utc)
                session.current_power_kw = 0.0
                return

        # Prüfe ob Ziel erreicht (Modus 4)
        if (
            session.mode == ChargingMode.TARGET_CHARGE.value
            and session.target_energy_kwh
            and session.energy_charged_kwh >= session.target_energy_kwh
        ):
            session.status = SessionStatus.COMPLETED.value
            session.completed_at = datetime.now(timezone.utc)
            session.current_power_kw = 0.0


async def sync_wallboxes_from_consumers(db: AsyncSession) -> int:
    """Synchronisiere Wallboxen aus Consumer-Configs (type=wallbox)."""
    result = await db.execute(select(ConsumerConfig))
    consumers = result.scalars().all()

    synced = 0
    for consumer in consumers:
        data = consumer.data
        if data.get("type") != "wallbox":
            continue

        # Wallbox mit consumer_config_id suchen
        wb_result = await db.execute(
            select(Wallbox).where(Wallbox.consumer_config_id == consumer.id)
        )
        wallbox = wb_result.scalar_one_or_none()

        phases = data.get("wallboxPhases", 3)
        min_current_a = data.get("wallboxMinCurrentA", 6)
        max_power_kw = data.get("wallboxMaxPowerKw", 11)
        min_power_kw = min_current_a * phases * 0.23

        if wallbox:
            wallbox.name = data.get("name", wallbox.name)
            wallbox.max_power_kw = max_power_kw
            wallbox.min_power_kw = min_power_kw
            wallbox.phases = phases
        else:
            wallbox = Wallbox(
                name=data.get("name", "Wallbox"),
                max_power_kw=max_power_kw,
                min_power_kw=min_power_kw,
                phases=phases,
                consumer_config_id=consumer.id,
            )
            db.add(wallbox)

        synced += 1

    await db.flush()
    return synced


async def get_vehicle_info_for_wallbox(
    db: AsyncSession, wallbox: Wallbox, vehicle_id: int | None = None,
) -> tuple[Vehicle | None, dict]:
    """Hole Fahrzeug-Info mit Priorität: explizite vehicle_id → Wallbox-Zuweisung → Consumer-Fallback.

    Returns: (Vehicle | None, vehicle_info_dict)
    """
    # 1. Explizite vehicle_id (aus Session-Erstellung)
    vehicle = None
    if vehicle_id:
        vehicle = await db.get(Vehicle, vehicle_id)
    # 2. Wallbox-Zuweisung
    if not vehicle and wallbox.assigned_vehicle_id:
        vehicle = await db.get(Vehicle, wallbox.assigned_vehicle_id)

    if vehicle:
        return vehicle, {
            "vehicle_battery_kwh": vehicle.battery_kwh,
            "vehicle_consumption_per_100km": vehicle.consumption_per_100km,
            "vehicle_name": f"{vehicle.brand} {vehicle.model}".strip() or vehicle.name,
            "wallbox_max_power_kw": wallbox.max_power_kw,
            "wallbox_phases": wallbox.phases,
            "ocpp_enabled": False,
        }

    # 3. Consumer-Config Fallback
    info = await get_consumer_vehicle_info(db, wallbox.consumer_config_id)
    return None, info


async def get_consumer_vehicle_info(db: AsyncSession, consumer_config_id: str | None) -> dict:
    """Hole Fahrzeug-Infos aus der Consumer-Config."""
    if not consumer_config_id:
        return {}
    consumer = await db.get(ConsumerConfig, consumer_config_id)
    if not consumer:
        return {}
    data = consumer.data
    return {
        "vehicle_battery_kwh": data.get("vehicleBatteryKwh"),
        "vehicle_consumption_per_100km": data.get("vehicleConsumptionPer100km"),
        "vehicle_name": data.get("notes", "").split(".")[0] if data.get("notes") else None,
        "wallbox_max_power_kw": data.get("wallboxMaxPowerKw"),
        "wallbox_phases": data.get("wallboxPhases"),
        "ocpp_enabled": data.get("ocppEnabled", False),
    }
