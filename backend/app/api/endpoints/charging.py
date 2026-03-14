from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.charging import ChargingMode, ChargingSession, SessionStatus, Vehicle, Wallbox
from app.schemas.charging import (
    ChargingAnalyticsResponse,
    ChargingAnalyticsSummary,
    ChargingModeUpdate,
    ChargingPeriodBucket,
    ChargingPeriodVehicle,
    ChargingPeriodVehicleMode,
    ChargingSessionPoint,
    ChargingSessionCreate,
    ChargingSessionResponse,
    ChargingStatistics,
    ChargingStatusResponse,
    TargetChargeRequest,
    VehicleCreate,
    VehicleInfo,
    VehicleResponse,
    VehicleUpdate,
    WallboxResponse,
    WallboxWithSession,
)
from app.services.charging_manager import (
    get_vehicle_info_for_wallbox,
    sync_wallboxes_from_consumers,
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
            ChargingSession.status.in_([
                SessionStatus.PENDING.value,
                SessionStatus.CHARGING.value,
                SessionStatus.PAUSED.value,
            ])
        )
    else:
        query = query.order_by(ChargingSession.created_at.desc()).limit(100)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/sessions", response_model=ChargingSessionResponse, status_code=201)
async def create_session(
    data: ChargingSessionCreate, db: AsyncSession = Depends(get_db)
):
    wallbox = await db.get(Wallbox, data.wallbox_id)
    if not wallbox:
        raise HTTPException(status_code=404, detail="Wallbox not found")

    # Fahrzeug-Info mit Prioritätskette: vehicle_id → Wallbox-Zuweisung → Consumer
    vehicle_battery = data.vehicle_battery_capacity_kwh
    vehicle_name = data.vehicle_name
    efficiency = data.vehicle_efficiency_kwh_per_km
    vehicle_id = data.vehicle_id
    soc_limit = data.soc_limit_pct

    vehicle, vi = await get_vehicle_info_for_wallbox(db, wallbox, vehicle_id)
    if vehicle and not vehicle_battery:
        vehicle_battery = vehicle.battery_kwh
        efficiency = vehicle.consumption_per_100km / 100
        vehicle_name = f"{vehicle.brand} {vehicle.model}".strip() or vehicle.name
        vehicle_id = vehicle.id
        if not soc_limit:
            soc_limit = vehicle.default_soc_limit_pct
    elif vi and not vehicle_battery:
        vehicle_battery = vi.get("vehicle_battery_kwh")
        if vi.get("vehicle_consumption_per_100km"):
            efficiency = vi["vehicle_consumption_per_100km"] / 100
        if vi.get("vehicle_name"):
            vehicle_name = vi["vehicle_name"]

    session = ChargingSession(
        wallbox_id=data.wallbox_id,
        vehicle_id=vehicle_id,
        mode=data.mode.value,
        status=SessionStatus.PENDING.value,
        vehicle_battery_capacity_kwh=vehicle_battery,
        vehicle_soc_pct=data.vehicle_soc_pct,
        vehicle_efficiency_kwh_per_km=efficiency,
        vehicle_name=vehicle_name,
        soc_limit_pct=soc_limit,
        target_km=data.target_km,
        target_time=data.target_time,
    )

    # Berechne Zielenergie für Modus 4 (Zielladung+PV-Überschuss)
    if data.mode == ChargingMode.TARGET_CHARGE and data.target_km:
        session.target_energy_kwh = data.target_km * efficiency

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

    session.mode = update.mode.value
    if update.target_km is not None:
        session.target_km = update.target_km
        session.target_energy_kwh = update.target_km * session.vehicle_efficiency_kwh_per_km
    if update.target_time is not None:
        session.target_time = update.target_time
    if update.soc_limit_pct is not None:
        session.soc_limit_pct = update.soc_limit_pct

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

    session.mode = ChargingMode.TARGET_CHARGE.value
    session.vehicle_soc_pct = target.vehicle_soc_pct
    session.target_km = target.target_km
    session.target_time = target.target_time

    if target.vehicle_battery_capacity_kwh:
        session.vehicle_battery_capacity_kwh = target.vehicle_battery_capacity_kwh

    session.target_energy_kwh = target.target_km * session.vehicle_efficiency_kwh_per_km

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/start", response_model=ChargingSessionResponse)
async def start_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChargingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = SessionStatus.CHARGING.value
    session.started_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/stop", response_model=ChargingSessionResponse)
async def stop_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChargingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = SessionStatus.COMPLETED.value
    session.completed_at = datetime.now(timezone.utc)
    session.current_power_kw = 0.0

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/pause", response_model=ChargingSessionResponse)
async def pause_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChargingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != SessionStatus.CHARGING.value:
        raise HTTPException(status_code=400, detail="Session is not charging")

    session.status = SessionStatus.PAUSED.value
    session.current_power_kw = 0.0

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/resume", response_model=ChargingSessionResponse)
async def resume_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(ChargingSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != SessionStatus.PAUSED.value:
        raise HTTPException(status_code=400, detail="Session is not paused")

    session.status = SessionStatus.CHARGING.value

    await db.flush()
    await db.refresh(session)
    return session


@router.post("/sync-wallboxes")
async def sync_wallboxes(db: AsyncSession = Depends(get_db)):
    """Synchronisiere Wallboxen aus Consumer-Configs (type=wallbox)."""
    count = await sync_wallboxes_from_consumers(db)
    await db.commit()
    return {"synced": count}


@router.get("/status", response_model=ChargingStatusResponse)
async def charging_status(db: AsyncSession = Depends(get_db)):
    """Gesamtstatus: Wallboxen + aktive Sessions + Statistik + Fahrzeug-Info."""
    wb_result = await db.execute(select(Wallbox).where(Wallbox.is_active == True))  # noqa: E712
    wallboxes = wb_result.scalars().all()

    active_statuses = [
        SessionStatus.PENDING.value,
        SessionStatus.CHARGING.value,
        SessionStatus.PAUSED.value,
    ]

    items: list[WallboxWithSession] = []
    total_power = 0.0
    active_count = 0

    for wb in wallboxes:
        sess_result = await db.execute(
            select(ChargingSession)
            .where(ChargingSession.wallbox_id == wb.id)
            .where(ChargingSession.status.in_(active_statuses))
            .order_by(ChargingSession.created_at.desc())
            .limit(1)
        )
        active_session = sess_result.scalar_one_or_none()

        # Fahrzeug-Info mit Prioritätskette
        vehicle, vi_data = await get_vehicle_info_for_wallbox(db, wb)
        vehicle_info = VehicleInfo(**vi_data) if vi_data else None

        # Zugewiesenes Fahrzeug laden
        assigned_vehicle = None
        if wb.assigned_vehicle_id:
            av = await db.get(Vehicle, wb.assigned_vehicle_id)
            if av:
                assigned_vehicle = VehicleResponse.model_validate(av)

        items.append(WallboxWithSession(
            wallbox=WallboxResponse.model_validate(wb),
            active_session=ChargingSessionResponse.model_validate(active_session) if active_session else None,
            vehicle_info=vehicle_info,
            assigned_vehicle=assigned_vehicle,
        ))

        if active_session and active_session.status == SessionStatus.CHARGING.value:
            total_power += active_session.current_power_kw
            active_count += 1

    # Heute geladene Energie
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_result = await db.execute(
        select(ChargingSession).where(ChargingSession.started_at >= today_start)
    )
    today_sessions = today_result.scalars().all()
    total_energy_today = sum(s.energy_charged_kwh for s in today_sessions)
    total_solar_today = sum(s.solar_energy_kwh for s in today_sessions)

    # 30-Tage-Statistik
    month_start = datetime.now(timezone.utc) - timedelta(days=30)
    stats_result = await db.execute(
        select(ChargingSession).where(
            ChargingSession.status == SessionStatus.COMPLETED.value,
            ChargingSession.started_at >= month_start,
        )
    )
    stats_sessions = stats_result.scalars().all()
    stats = None
    if stats_sessions:
        t_energy = sum(s.energy_charged_kwh for s in stats_sessions)
        t_solar = sum(s.solar_energy_kwh for s in stats_sessions)
        t_grid = sum(s.grid_energy_kwh for s in stats_sessions)
        t_cost = sum(s.cost_ct for s in stats_sessions)
        stats = ChargingStatistics(
            total_sessions=len(stats_sessions),
            total_energy_kwh=round(t_energy, 1),
            total_solar_kwh=round(t_solar, 1),
            total_grid_kwh=round(t_grid, 1),
            total_cost_ct=round(t_cost, 1),
            avg_solar_pct=round((t_solar / t_energy * 100) if t_energy > 0 else 0, 1),
            avg_cost_ct_per_kwh=round((t_cost / t_energy) if t_energy > 0 else 0, 1),
        )

    return ChargingStatusResponse(
        wallboxes=items,
        total_charging_power_kw=total_power,
        active_sessions_count=active_count,
        total_energy_today_kwh=total_energy_today,
        total_solar_today_kwh=total_solar_today,
        statistics_30d=stats,
    )


# ==================== Analytics ====================

GERMAN_MONTHS = [
    "", "Jan", "Feb", "Mrz", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
]


def _session_duration_hours(s: ChargingSession) -> float:
    if not s.started_at:
        return 0.0
    end = s.completed_at or datetime.now(timezone.utc)
    return max((end - s.started_at).total_seconds() / 3600, 0)


def _bucket_key(dt: datetime, grouping: str) -> tuple:
    if grouping == "week":
        iso = dt.isocalendar()
        return (iso[0], iso[1])
    elif grouping == "month":
        return (dt.year, dt.month)
    else:
        return (dt.year, dt.month, dt.day)


def _bucket_label(key: tuple, grouping: str) -> str:
    if grouping == "week":
        return f"KW {key[1]}"
    elif grouping == "month":
        return f"{GERMAN_MONTHS[key[1]]} {key[0]}"
    else:
        return f"{key[2]:02d}.{key[1]:02d}."


def _bucket_start_iso(key: tuple, grouping: str) -> str:
    if grouping == "week":
        from datetime import date as _date
        d = _date.fromisocalendar(key[0], key[1], 1)
        return d.isoformat()
    elif grouping == "month":
        return f"{key[0]}-{key[1]:02d}-01"
    else:
        return f"{key[0]}-{key[1]:02d}-{key[2]:02d}"


def _aggregate_vehicle_modes(
    sessions: list[ChargingSession],
) -> list[ChargingPeriodVehicleMode]:
    by_mode: dict[str, list[ChargingSession]] = {}
    for s in sessions:
        by_mode.setdefault(s.mode, []).append(s)

    result = []
    for mode, ss in sorted(by_mode.items()):
        energy = sum(s.energy_charged_kwh for s in ss)
        dur_h = sum(_session_duration_hours(s) for s in ss)
        result.append(ChargingPeriodVehicleMode(
            mode=mode,
            sessions=len(ss),
            energy_kwh=round(energy, 2),
            solar_kwh=round(sum(s.solar_energy_kwh for s in ss), 2),
            grid_kwh=round(sum(s.grid_energy_kwh for s in ss), 2),
            cost_ct=round(sum(s.cost_ct for s in ss), 2),
            avg_power_kw=round(energy / dur_h, 2) if dur_h > 0 else 0.0,
            total_duration_min=round(dur_h * 60, 1),
        ))
    return result


def _aggregate_vehicles(
    sessions: list[ChargingSession],
) -> list[ChargingPeriodVehicle]:
    by_vehicle: dict[int | None, list[ChargingSession]] = {}
    for s in sessions:
        by_vehicle.setdefault(s.vehicle_id, []).append(s)

    result = []
    for vid, ss in sorted(by_vehicle.items(), key=lambda x: (x[0] is None, x[0])):
        energy = sum(s.energy_charged_kwh for s in ss)
        solar = sum(s.solar_energy_kwh for s in ss)
        grid = sum(s.grid_energy_kwh for s in ss)
        cost = sum(s.cost_ct for s in ss)
        dur_h = sum(_session_duration_hours(s) for s in ss)
        name = ss[0].vehicle_name or "Unbekannt"
        result.append(ChargingPeriodVehicle(
            vehicle_id=vid,
            vehicle_name=name,
            sessions=len(ss),
            energy_kwh=round(energy, 2),
            solar_kwh=round(solar, 2),
            grid_kwh=round(grid, 2),
            cost_ct=round(cost, 2),
            avg_power_kw=round(energy / dur_h, 2) if dur_h > 0 else 0.0,
            avg_solar_pct=round(solar / energy * 100, 1) if energy > 0 else 0.0,
            modes=_aggregate_vehicle_modes(ss),
        ))
    return result


@router.get("/analytics", response_model=ChargingAnalyticsResponse)
async def charging_analytics(
    from_date: str,
    to_date: str,
    grouping: str = "month",
    db: AsyncSession = Depends(get_db),
):
    """Aggregierte Ladestatistik über beliebigen Zeitraum."""
    from datetime import date as _date

    try:
        dt_from = datetime.fromisoformat(from_date)
        dt_to = datetime.fromisoformat(to_date).replace(hour=23, minute=59, second=59)
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datum (ISO-Format erwartet)")

    if grouping not in ("day", "week", "month"):
        raise HTTPException(status_code=400, detail="grouping muss day/week/month sein")

    # Alle abgeschlossenen Sessions im Zeitraum
    result = await db.execute(
        select(ChargingSession).where(
            ChargingSession.status.in_([
                SessionStatus.COMPLETED.value,
                SessionStatus.CANCELLED.value,
            ]),
            ChargingSession.started_at >= dt_from,
            ChargingSession.started_at <= dt_to,
        )
    )
    all_sessions = result.scalars().all()

    # Fahrzeug-Liste für Filter-Dropdown
    v_result = await db.execute(select(Vehicle))
    all_vehicles = v_result.scalars().all()
    vehicle_list = [{"id": v.id, "name": v.name} for v in all_vehicles]

    # In Buckets gruppieren
    buckets_map: dict[tuple, list[ChargingSession]] = {}
    for s in all_sessions:
        if not s.started_at:
            continue
        key = _bucket_key(s.started_at, grouping)
        buckets_map.setdefault(key, []).append(s)

    buckets: list[ChargingPeriodBucket] = []
    for key in sorted(buckets_map.keys()):
        ss = buckets_map[key]
        energy = sum(s.energy_charged_kwh for s in ss)
        solar = sum(s.solar_energy_kwh for s in ss)
        grid = sum(s.grid_energy_kwh for s in ss)
        cost = sum(s.cost_ct for s in ss)
        dur_h = sum(_session_duration_hours(s) for s in ss)
        buckets.append(ChargingPeriodBucket(
            period_start=_bucket_start_iso(key, grouping),
            period_label=_bucket_label(key, grouping),
            sessions=len(ss),
            energy_kwh=round(energy, 2),
            solar_kwh=round(solar, 2),
            grid_kwh=round(grid, 2),
            cost_ct=round(cost, 2),
            avg_power_kw=round(energy / dur_h, 2) if dur_h > 0 else 0.0,
            avg_solar_pct=round(solar / energy * 100, 1) if energy > 0 else 0.0,
            vehicles=_aggregate_vehicles(ss),
        ))

    # Summary
    total_energy = sum(s.energy_charged_kwh for s in all_sessions)
    total_solar = sum(s.solar_energy_kwh for s in all_sessions)
    total_grid = sum(s.grid_energy_kwh for s in all_sessions)
    total_cost = sum(s.cost_ct for s in all_sessions)
    total_dur_h = sum(_session_duration_hours(s) for s in all_sessions)

    mode_dist: dict[str, int] = {}
    vehicle_ids: set[int | None] = set()
    for s in all_sessions:
        mode_dist[s.mode] = mode_dist.get(s.mode, 0) + 1
        if s.vehicle_id is not None:
            vehicle_ids.add(s.vehicle_id)

    summary = ChargingAnalyticsSummary(
        sessions=len(all_sessions),
        energy_kwh=round(total_energy, 2),
        solar_kwh=round(total_solar, 2),
        grid_kwh=round(total_grid, 2),
        cost_ct=round(total_cost, 2),
        avg_power_kw=round(total_energy / total_dur_h, 2) if total_dur_h > 0 else 0.0,
        avg_solar_pct=round(total_solar / total_energy * 100, 1) if total_energy > 0 else 0.0,
        avg_cost_ct_per_kwh=round(total_cost / total_energy, 2) if total_energy > 0 else 0.0,
        mode_distribution=mode_dist,
        vehicle_count=len(vehicle_ids),
    )

    # Session-Punkte für Leistungsdiagramm
    session_points: list[ChargingSessionPoint] = []
    for s in sorted(all_sessions, key=lambda x: x.started_at or datetime.min):
        if not s.started_at:
            continue
        dur_h = _session_duration_hours(s)
        dur_min = round(dur_h * 60, 1)
        avg_kw = round(s.energy_charged_kwh / dur_h, 2) if dur_h > 0 else 0.0
        session_points.append(ChargingSessionPoint(
            id=s.id,
            started_at=s.started_at.isoformat(),
            completed_at=s.completed_at.isoformat() if s.completed_at else None,
            vehicle_id=s.vehicle_id,
            vehicle_name=s.vehicle_name,
            mode=s.mode,
            energy_kwh=round(s.energy_charged_kwh, 2),
            duration_min=dur_min,
            avg_power_kw=avg_kw,
        ))

    return ChargingAnalyticsResponse(
        from_date=from_date,
        to_date=to_date,
        grouping=grouping,
        summary=summary,
        buckets=buckets,
        vehicles=vehicle_list,
        session_points=session_points,
    )


# ==================== Vehicle CRUD ====================

@router.get("/vehicles", response_model=list[VehicleResponse])
async def list_vehicles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vehicle).where(Vehicle.is_active == True))  # noqa: E712
    return result.scalars().all()


@router.post("/vehicles", response_model=VehicleResponse, status_code=201)
async def create_vehicle(data: VehicleCreate, db: AsyncSession = Depends(get_db)):
    vehicle = Vehicle(**data.model_dump())
    db.add(vehicle)
    await db.flush()
    await db.refresh(vehicle)
    return vehicle


@router.get("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def get_vehicle(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.put("/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: int, data: VehicleUpdate, db: AsyncSession = Depends(get_db)
):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(vehicle, key, val)
    await db.flush()
    await db.refresh(vehicle)
    return vehicle


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: int, db: AsyncSession = Depends(get_db)):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    vehicle.is_active = False
    await db.flush()
    return {"deleted": True}


@router.post("/wallboxes/{wallbox_id}/assign-vehicle")
async def assign_vehicle(
    wallbox_id: int,
    vehicle_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Fahrzeug einer Wallbox zuweisen (vehicle_id=None zum Entfernen)."""
    wallbox = await db.get(Wallbox, wallbox_id)
    if not wallbox:
        raise HTTPException(status_code=404, detail="Wallbox not found")
    if vehicle_id is not None:
        vehicle = await db.get(Vehicle, vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
    wallbox.assigned_vehicle_id = vehicle_id
    await db.flush()
    return {"wallbox_id": wallbox_id, "assigned_vehicle_id": vehicle_id}
