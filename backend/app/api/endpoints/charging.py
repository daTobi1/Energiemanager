from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.charging import ChargingMode, ChargingSession, SessionStatus, Wallbox
from app.schemas.charging import (
    ChargingModeUpdate,
    ChargingSessionCreate,
    ChargingSessionResponse,
    TargetChargeRequest,
    WallboxResponse,
)

router = APIRouter()


@router.get("/wallboxes", response_model=list[WallboxResponse])
async def list_wallboxes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Wallbox))
    return result.scalars().all()


@router.get("/sessions", response_model=list[ChargingSessionResponse])
async def list_sessions(
    active_only: bool = True, db: AsyncSession = Depends(get_db)
):
    query = select(ChargingSession)
    if active_only:
        query = query.where(
            ChargingSession.status.in_([SessionStatus.PENDING, SessionStatus.CHARGING])
        )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/sessions", response_model=ChargingSessionResponse, status_code=201)
async def create_session(
    data: ChargingSessionCreate, db: AsyncSession = Depends(get_db)
):
    wallbox = await db.get(Wallbox, data.wallbox_id)
    if not wallbox:
        raise HTTPException(status_code=404, detail="Wallbox not found")

    session = ChargingSession(
        wallbox_id=data.wallbox_id,
        mode=data.mode,
        status=SessionStatus.PENDING,
        vehicle_battery_capacity_kwh=data.vehicle_battery_capacity_kwh,
        vehicle_soc_pct=data.vehicle_soc_pct,
        vehicle_efficiency_kwh_per_km=data.vehicle_efficiency_kwh_per_km,
        target_km=data.target_km,
        target_time=data.target_time,
    )

    # Berechne Zielenergie für Modus 3
    if data.mode == ChargingMode.TARGET_CHARGE and data.target_km:
        session.target_energy_kwh = data.target_km * data.vehicle_efficiency_kwh_per_km

    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


@router.put("/sessions/{session_id}/mode", response_model=ChargingSessionResponse)
async def update_mode(
    session_id: int, update: ChargingModeUpdate, db: AsyncSession = Depends(get_db)
):
    session = await db.get(ChargingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.mode = update.mode
    if update.target_km is not None:
        session.target_km = update.target_km
        session.target_energy_kwh = update.target_km * session.vehicle_efficiency_kwh_per_km
    if update.target_time is not None:
        session.target_time = update.target_time

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/target", response_model=ChargingSessionResponse)
async def set_target_charge(
    session_id: int, target: TargetChargeRequest, db: AsyncSession = Depends(get_db)
):
    session = await db.get(ChargingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.mode = ChargingMode.TARGET_CHARGE
    session.vehicle_soc_pct = target.vehicle_soc_pct
    session.target_km = target.target_km
    session.target_time = target.target_time

    if target.vehicle_battery_capacity_kwh:
        session.vehicle_battery_capacity_kwh = target.vehicle_battery_capacity_kwh

    # Berechne benötigte Energie
    session.target_energy_kwh = target.target_km * session.vehicle_efficiency_kwh_per_km

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/start", response_model=ChargingSessionResponse)
async def start_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChargingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = SessionStatus.CHARGING
    session.started_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/stop", response_model=ChargingSessionResponse)
async def stop_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChargingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = SessionStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(session)
    return session
