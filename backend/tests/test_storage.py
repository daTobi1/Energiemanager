from app.models.storage import EnergyStorage, StorageType
from app.services.storage_manager import StorageManager


async def test_charge_battery(db_session):
    battery = EnergyStorage(
        name="Batterie",
        type=StorageType.BATTERY,
        capacity_kwh=10.0,
        max_charge_kw=5.0,
        max_discharge_kw=5.0,
        soc_pct=50.0,
    )
    db_session.add(battery)
    await db_session.flush()

    manager = StorageManager(db_session)
    success = await manager.charge(battery.id, power_kw=5.0, duration_hours=0.25)
    assert success
    assert battery.soc_pct > 50.0


async def test_discharge_battery(db_session):
    battery = EnergyStorage(
        name="Batterie",
        type=StorageType.BATTERY,
        capacity_kwh=10.0,
        max_charge_kw=5.0,
        max_discharge_kw=5.0,
        soc_pct=50.0,
    )
    db_session.add(battery)
    await db_session.flush()

    manager = StorageManager(db_session)
    success = await manager.discharge(battery.id, power_kw=3.0, duration_hours=0.25)
    assert success
    assert battery.soc_pct < 50.0


async def test_charge_respects_max_soc(db_session):
    battery = EnergyStorage(
        name="Batterie",
        type=StorageType.BATTERY,
        capacity_kwh=10.0,
        max_charge_kw=5.0,
        max_discharge_kw=5.0,
        soc_pct=88.0,
        soc_max_pct=90.0,
    )
    db_session.add(battery)
    await db_session.flush()

    manager = StorageManager(db_session)
    await manager.charge(battery.id, power_kw=5.0, duration_hours=1.0)
    assert battery.soc_pct <= 90.0
