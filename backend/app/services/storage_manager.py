"""Speichermanagement — SoC-Tracking und Lade-/Entladelogik."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.storage import EnergyStorage, StorageType


class StorageManager:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_battery_status(self) -> list[EnergyStorage]:
        result = await self.db.execute(
            select(EnergyStorage).where(
                EnergyStorage.type == StorageType.BATTERY, EnergyStorage.is_active
            )
        )
        return list(result.scalars().all())

    async def charge(self, storage_id: int, power_kw: float, duration_hours: float) -> bool:
        """Lade einen Speicher mit gegebener Leistung und Dauer."""
        storage = await self.db.get(EnergyStorage, storage_id)
        if not storage or not storage.is_active:
            return False

        power_kw = min(power_kw, storage.max_charge_kw)
        energy_kwh = power_kw * duration_hours
        new_soc = storage.soc_pct + (energy_kwh / storage.capacity_kwh) * 100

        if new_soc > storage.soc_max_pct:
            new_soc = storage.soc_max_pct
            power_kw = 0.0  # Speicher voll

        storage.soc_pct = new_soc
        storage.current_power_kw = power_kw
        return True

    async def discharge(self, storage_id: int, power_kw: float, duration_hours: float) -> bool:
        """Entlade einen Speicher."""
        storage = await self.db.get(EnergyStorage, storage_id)
        if not storage or not storage.is_active:
            return False

        power_kw = min(power_kw, storage.max_discharge_kw)
        energy_kwh = power_kw * duration_hours
        new_soc = storage.soc_pct - (energy_kwh / storage.capacity_kwh) * 100

        if new_soc < storage.soc_min_pct:
            new_soc = storage.soc_min_pct
            power_kw = 0.0  # Speicher leer

        storage.soc_pct = new_soc
        storage.current_power_kw = -power_kw
        return True

    async def get_available_discharge_kwh(self, storage_id: int) -> float:
        """Verfügbare Entladeenergie in kWh."""
        storage = await self.db.get(EnergyStorage, storage_id)
        if not storage:
            return 0.0
        usable_soc = max(0, storage.soc_pct - storage.soc_min_pct)
        return (usable_soc / 100) * storage.capacity_kwh
