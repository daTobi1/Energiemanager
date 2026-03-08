from pydantic import BaseModel

from app.models.storage import StorageType


class StorageBase(BaseModel):
    name: str
    type: StorageType
    capacity_kwh: float
    max_charge_kw: float
    max_discharge_kw: float
    soc_min_pct: float = 10.0
    soc_max_pct: float = 90.0


class StorageCreate(StorageBase):
    pass


class StorageResponse(StorageBase):
    id: int
    soc_pct: float
    current_power_kw: float
    is_active: bool

    model_config = {"from_attributes": True}
