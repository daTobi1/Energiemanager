from datetime import datetime

from pydantic import BaseModel, computed_field

from app.models.charging import ChargingMode


class VehicleCreate(BaseModel):
    name: str
    brand: str = ""
    model: str = ""
    license_plate: str = ""
    battery_kwh: float = 60.0
    consumption_per_100km: float = 16.7
    default_soc_limit_pct: float = 80.0
    max_ac_power_kw: float = 11.0
    connector_type: str = "type2"
    color: str = ""
    year: int | None = None


class VehicleUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    model: str | None = None
    license_plate: str | None = None
    battery_kwh: float | None = None
    consumption_per_100km: float | None = None
    default_soc_limit_pct: float | None = None
    max_ac_power_kw: float | None = None
    connector_type: str | None = None
    color: str | None = None
    year: int | None = None
    is_active: bool | None = None


class VehicleResponse(BaseModel):
    id: int
    name: str
    brand: str
    model: str
    license_plate: str
    battery_kwh: float
    consumption_per_100km: float
    default_soc_limit_pct: float
    max_ac_power_kw: float
    connector_type: str
    color: str
    year: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class WallboxResponse(BaseModel):
    id: int
    name: str
    max_power_kw: float
    min_power_kw: float
    phases: int
    is_active: bool
    consumer_config_id: str | None = None
    assigned_vehicle_id: int | None = None

    model_config = {"from_attributes": True}


class ChargingSessionCreate(BaseModel):
    wallbox_id: int
    mode: ChargingMode
    vehicle_id: int | None = None

    # Vehicle info (optional, override)
    vehicle_battery_capacity_kwh: float | None = None
    vehicle_soc_pct: float | None = None
    vehicle_efficiency_kwh_per_km: float = 0.167
    vehicle_name: str | None = None

    # SoC-Limit
    soc_limit_pct: float | None = None

    # Target charge + PV surplus (Modus 4)
    target_km: float | None = None
    target_time: datetime | None = None


class ChargingSessionResponse(BaseModel):
    id: int
    wallbox_id: int
    vehicle_id: int | None = None
    mode: str
    status: str
    current_power_kw: float
    energy_charged_kwh: float
    solar_energy_kwh: float = 0.0
    grid_energy_kwh: float = 0.0
    cost_ct: float = 0.0
    vehicle_battery_capacity_kwh: float | None = None
    vehicle_soc_pct: float | None = None
    vehicle_name: str | None = None
    soc_limit_pct: float | None = None
    target_km: float | None = None
    target_time: datetime | None = None
    target_energy_kwh: float | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    @computed_field
    @property
    def solar_pct(self) -> float:
        if self.energy_charged_kwh <= 0:
            return 0.0
        return round((self.solar_energy_kwh / self.energy_charged_kwh) * 100, 1)

    @computed_field
    @property
    def duration_min(self) -> float | None:
        if not self.started_at:
            return None
        end = self.completed_at or datetime.utcnow()
        return round((end - self.started_at).total_seconds() / 60, 1)

    model_config = {"from_attributes": True}


class ChargingModeUpdate(BaseModel):
    mode: ChargingMode
    target_km: float | None = None
    target_time: datetime | None = None
    soc_limit_pct: float | None = None


class TargetChargeRequest(BaseModel):
    vehicle_soc_pct: float
    target_km: float
    target_time: datetime
    vehicle_battery_capacity_kwh: float | None = None


class VehicleInfo(BaseModel):
    vehicle_battery_kwh: float | None = None
    vehicle_consumption_per_100km: float | None = None
    vehicle_name: str | None = None
    wallbox_max_power_kw: float | None = None
    wallbox_phases: int | None = None
    ocpp_enabled: bool = False


class WallboxWithSession(BaseModel):
    wallbox: WallboxResponse
    active_session: ChargingSessionResponse | None = None
    vehicle_info: VehicleInfo | None = None
    assigned_vehicle: VehicleResponse | None = None


class ChargingStatistics(BaseModel):
    total_sessions: int
    total_energy_kwh: float
    total_solar_kwh: float
    total_grid_kwh: float
    total_cost_ct: float
    avg_solar_pct: float
    avg_cost_ct_per_kwh: float


class ChargingStatusResponse(BaseModel):
    wallboxes: list[WallboxWithSession]
    total_charging_power_kw: float
    active_sessions_count: int
    total_energy_today_kwh: float
    total_solar_today_kwh: float
    statistics_30d: ChargingStatistics | None = None


# ==================== Analytics ====================


class ChargingPeriodVehicleMode(BaseModel):
    mode: str
    sessions: int
    energy_kwh: float
    solar_kwh: float
    grid_kwh: float
    cost_ct: float
    avg_power_kw: float
    total_duration_min: float


class ChargingPeriodVehicle(BaseModel):
    vehicle_id: int | None
    vehicle_name: str
    sessions: int
    energy_kwh: float
    solar_kwh: float
    grid_kwh: float
    cost_ct: float
    avg_power_kw: float
    avg_solar_pct: float
    modes: list[ChargingPeriodVehicleMode]


class ChargingPeriodBucket(BaseModel):
    period_start: str
    period_label: str
    sessions: int
    energy_kwh: float
    solar_kwh: float
    grid_kwh: float
    cost_ct: float
    avg_power_kw: float
    avg_solar_pct: float
    vehicles: list[ChargingPeriodVehicle]


class ChargingAnalyticsSummary(BaseModel):
    sessions: int
    energy_kwh: float
    solar_kwh: float
    grid_kwh: float
    cost_ct: float
    avg_power_kw: float
    avg_solar_pct: float
    avg_cost_ct_per_kwh: float
    mode_distribution: dict[str, int]
    vehicle_count: int


class ChargingSessionPoint(BaseModel):
    id: int
    started_at: str
    completed_at: str | None
    vehicle_id: int | None
    vehicle_name: str | None
    mode: str
    energy_kwh: float
    duration_min: float
    avg_power_kw: float


class ChargingAnalyticsResponse(BaseModel):
    from_date: str
    to_date: str
    grouping: str
    summary: ChargingAnalyticsSummary
    buckets: list[ChargingPeriodBucket]
    vehicles: list[dict]
    session_points: list[ChargingSessionPoint]
