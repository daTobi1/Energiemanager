from datetime import datetime

from pydantic import BaseModel

from app.models.charging import ChargingMode, SessionStatus


class WallboxResponse(BaseModel):
    id: int
    name: str
    max_power_kw: float
    min_power_kw: float
    phases: int
    is_active: bool

    model_config = {"from_attributes": True}


class ChargingSessionCreate(BaseModel):
    wallbox_id: int
    mode: ChargingMode

    # Vehicle info (optional)
    vehicle_battery_capacity_kwh: float | None = None
    vehicle_soc_pct: float | None = None
    vehicle_efficiency_kwh_per_km: float = 0.167

    # Target charge (Modus 3)
    target_km: float | None = None
    target_time: datetime | None = None


class ChargingSessionResponse(BaseModel):
    id: int
    wallbox_id: int
    mode: ChargingMode
    status: SessionStatus
    current_power_kw: float
    energy_charged_kwh: float
    vehicle_soc_pct: float | None
    target_km: float | None
    target_time: datetime | None
    target_energy_kwh: float | None
    started_at: datetime | None
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class ChargingModeUpdate(BaseModel):
    mode: ChargingMode
    target_km: float | None = None
    target_time: datetime | None = None


class TargetChargeRequest(BaseModel):
    vehicle_soc_pct: float
    target_km: float
    target_time: datetime
    vehicle_battery_capacity_kwh: float | None = None
