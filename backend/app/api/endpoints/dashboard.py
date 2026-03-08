from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.charging import ChargingSession, SessionStatus
from app.models.generator import Generator, GeneratorType
from app.models.storage import EnergyStorage, StorageType
from app.schemas.forecast import DashboardResponse

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    """Aktuelle Energieflüsse und KPIs."""

    # PV-Leistung
    pv_result = await db.execute(
        select(Generator).where(Generator.type == GeneratorType.PV, Generator.is_active)
    )
    pv_generators = pv_result.scalars().all()
    pv_power = sum(g.current_power_kw for g in pv_generators)

    # Batterie
    bat_result = await db.execute(
        select(EnergyStorage).where(
            EnergyStorage.type == StorageType.BATTERY, EnergyStorage.is_active
        )
    )
    batteries = bat_result.scalars().all()
    battery_soc = batteries[0].soc_pct if batteries else None
    battery_power = sum(b.current_power_kw for b in batteries)

    # Wärmespeicher
    heat_result = await db.execute(
        select(EnergyStorage).where(
            EnergyStorage.type == StorageType.HEAT, EnergyStorage.is_active
        )
    )
    heat_storages = heat_result.scalars().all()
    heat_soc = heat_storages[0].soc_pct if heat_storages else None

    # Ladeleistung
    charging_result = await db.execute(
        select(ChargingSession).where(ChargingSession.status == SessionStatus.CHARGING)
    )
    sessions = charging_result.scalars().all()
    charging_power = sum(s.current_power_kw for s in sessions)

    # Berechnung (vereinfacht)
    total_consumption = charging_power + battery_power  # Vereinfacht
    grid_power = total_consumption - pv_power
    self_sufficiency = min(100.0, (pv_power / max(total_consumption, 0.01)) * 100) if pv_power > 0 else 0.0

    return DashboardResponse(
        pv_power_kw=pv_power,
        grid_power_kw=grid_power,
        total_consumption_kw=total_consumption,
        battery_soc_pct=battery_soc,
        battery_power_kw=battery_power,
        heat_storage_soc_pct=heat_soc,
        charging_power_kw=charging_power,
        self_sufficiency_pct=self_sufficiency,
    )
