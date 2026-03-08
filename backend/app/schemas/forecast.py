from datetime import datetime

from pydantic import BaseModel


class ForecastPoint(BaseModel):
    forecast_time: datetime
    value_kw: float
    confidence_lower_kw: float | None = None
    confidence_upper_kw: float | None = None


class ForecastResponse(BaseModel):
    forecast_type: str
    model_version: str
    points: list[ForecastPoint]


class DashboardResponse(BaseModel):
    pv_power_kw: float
    grid_power_kw: float  # positiv = Bezug, negativ = Einspeisung
    total_consumption_kw: float
    battery_soc_pct: float | None
    battery_power_kw: float  # positiv = Laden, negativ = Entladen
    heat_storage_soc_pct: float | None
    charging_power_kw: float
    self_sufficiency_pct: float
