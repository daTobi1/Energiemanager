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
        mode=ChargingMode.MAX_SPEED.value,
        status=SessionStatus.CHARGING.value,
    )
    db_session.add(session)
    await db_session.flush()
    return session


@pytest.fixture
async def session_pv_surplus(db_session, wallbox):
    session = ChargingSession(
        wallbox_id=wallbox.id,
        mode=ChargingMode.PV_SURPLUS.value,
        status=SessionStatus.CHARGING.value,
    )
    db_session.add(session)
    await db_session.flush()
    return session


@pytest.fixture
async def session_min_pv(db_session, wallbox):
    session = ChargingSession(
        wallbox_id=wallbox.id,
        mode=ChargingMode.MIN_PV.value,
        status=SessionStatus.CHARGING.value,
    )
    db_session.add(session)
    await db_session.flush()
    return session


@pytest.fixture
async def session_target(db_session, wallbox):
    session = ChargingSession(
        wallbox_id=wallbox.id,
        mode=ChargingMode.TARGET_CHARGE.value,
        status=SessionStatus.CHARGING.value,
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


async def test_min_pv_always_minimum(db_session, session_min_pv):
    """Min+Solar: Lädt immer mindestens mit Mindestleistung."""
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_min_pv, surplus_kw=0.0)
    assert power == 1.4  # min_power_kw


async def test_min_pv_with_surplus(db_session, session_min_pv):
    """Min+Solar: PV-Boost wenn Überschuss vorhanden."""
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_min_pv, surplus_kw=5.0)
    assert power == 5.0


async def test_min_pv_capped_at_max(db_session, session_min_pv):
    """Min+Solar: Begrenzt auf Wallbox-Maximum."""
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_min_pv, surplus_kw=15.0)
    assert power == 11.0


async def test_target_charge_calculates_power(db_session, session_target):
    manager = ChargingManager(db_session)
    power = await manager.calculate_charging_power(session_target, surplus_kw=0.0)
    # 25 kWh / 8h ≈ 3.125 kW
    assert 2.5 <= power <= 4.0


async def test_update_session_energy_tracks_solar(db_session, session_max_speed):
    """Solar/Grid-Aufschlüsselung wird korrekt berechnet."""
    manager = ChargingManager(db_session)
    await manager.update_session_energy(
        session_max_speed, power_kw=11.0, duration_hours=1.0,
        surplus_kw=7.0, grid_price_ct_per_kwh=30.0,
    )
    assert session_max_speed.energy_charged_kwh == 11.0
    assert session_max_speed.solar_energy_kwh == 7.0
    assert session_max_speed.grid_energy_kwh == 4.0
    assert session_max_speed.cost_ct == pytest.approx(120.0)  # 4 kWh * 30 ct


async def test_soc_limit_stops_charging(db_session, wallbox):
    """Laden stoppt wenn SoC-Limit erreicht."""
    session = ChargingSession(
        wallbox_id=wallbox.id,
        mode=ChargingMode.MAX_SPEED.value,
        status=SessionStatus.CHARGING.value,
        vehicle_battery_capacity_kwh=50.0,
        vehicle_soc_pct=78.0,
        soc_limit_pct=80.0,
    )
    db_session.add(session)
    await db_session.flush()

    manager = ChargingManager(db_session)
    await manager.update_session_energy(session, power_kw=11.0, duration_hours=0.1)
    # 1.1 kWh geladen → +2.2% SoC → 80.2% > 80% Limit
    assert session.status == SessionStatus.COMPLETED.value
