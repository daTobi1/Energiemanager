"""Lademanagement — steuert Wallboxen und Ladesessions."""

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.charging import ChargingMode, ChargingSession, SessionStatus, Wallbox


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

        if session.mode == ChargingMode.MAX_SPEED:
            return wallbox.max_power_kw

        elif session.mode == ChargingMode.PV_SURPLUS:
            return self._pv_surplus_power(wallbox, surplus_kw)

        elif session.mode == ChargingMode.TARGET_CHARGE:
            return self._target_charge_power(session, wallbox, surplus_kw)

        return 0.0

    def _pv_surplus_power(self, wallbox: Wallbox, surplus_kw: float) -> float:
        """Modus 2: Nur laden wenn PV-Überschuss vorhanden."""
        if surplus_kw < wallbox.min_power_kw:
            return 0.0
        return min(surplus_kw, wallbox.max_power_kw)

    def _target_charge_power(
        self, session: ChargingSession, wallbox: Wallbox, surplus_kw: float
    ) -> float:
        """Modus 3: Zielladung berechnen."""
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
        self, session: ChargingSession, power_kw: float, duration_hours: float
    ) -> None:
        """Aktualisiere geladene Energie einer Session."""
        session.current_power_kw = power_kw
        session.energy_charged_kwh += power_kw * duration_hours

        # Prüfe ob Ziel erreicht
        if (
            session.mode == ChargingMode.TARGET_CHARGE
            and session.target_energy_kwh
            and session.energy_charged_kwh >= session.target_energy_kwh
        ):
            session.status = SessionStatus.COMPLETED
            session.completed_at = datetime.now(timezone.utc)
