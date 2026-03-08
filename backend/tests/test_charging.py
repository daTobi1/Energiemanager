from datetime import datetime, timedelta, timezone

import pytest

from app.models.charging import ChargingMode, ChargingSession, SessionStatus, Wallbox
from app.services.charging_manager import ChargingManager


@pytest.fixture
async def wallbox(db_session):
    wb = Wallbox(name="Test Wallbox", max_power_kw=11.0, min_power_kw=1.4, phases=3)
    db_session.add(wb)
    await db_session.flush()
    return wb


@pytest.fixture
async def session_max_speed(db_session, wallbox):
    session = ChargingSession(
        wallbox_id=wallbox.id,
        mode=ChargingMode.MAX_SPEED,
        status=SessionStatus.CHARGING,
    )
    db_session.add(session)
    await db_session.flush()
    return session


@pytest.fixture
async def session_pv_surplus(db_session, wallbox):
    session = ChargingSession(
        wallbox_id=wallbox.id,
        mode=ChargingMode.PV_SURPLUS,
        status=SessionStatus.CHARGING,
    )
    db_session.add(session)
    await db_session.flush()
    return session


@pytest.fixture
async def session_target(db_session, wallbox):
    session = ChargingSession(
        wallbox_id=wallbox.id,
        mode=ChargingMode.TARGET_CHARGE,
        status=SessionStatus.CHARGING,
        target_energy_kwh=25.0,
        target_time=datetime.now(timezone.utc) + timedelta(hours=8),
        energy_charged_kwh=0.0,
    )
    db_session.add(session)
    await db_session.flush()
    return session


async def test_max_speed_uses_full_power(db_session, session_max_speed):
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_max_speed, surplus_kw=0.0)
    assert power == 11.0


async def test_pv_surplus_no_surplus(db_session, session_pv_surplus):
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_pv_surplus, surplus_kw=0.5)
    assert power == 0.0  # Under min_power_kw


async def test_pv_surplus_with_surplus(db_session, session_pv_surplus):
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_pv_surplus, surplus_kw=5.0)
    assert power == 5.0


async def test_pv_surplus_capped_at_max(db_session, session_pv_surplus):
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_pv_surplus, surplus_kw=15.0)
    assert power == 11.0  # Capped at wallbox max


async def test_target_charge_calculates_power(db_session, session_target):
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_target, surplus_kw=0.0)
    # 25 kWh / 8h ≈ 3.125 kW
    assert 2.5 <= power <= 4.0
