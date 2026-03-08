import enum

from sqlalchemy import Enum, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class StorageType(str, enum.Enum):
    BATTERY = "battery"
    HEAT = "heat"
    COLD = "cold"


class EnergyStorage(Base, TimestampMixin):
    __tablename__ = "energy_storage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[StorageType] = mapped_column(Enum(StorageType))

    # Capacity
    capacity_kwh: Mapped[float] = mapped_column(Float)
    max_charge_kw: Mapped[float] = mapped_column(Float)
    max_discharge_kw: Mapped[float] = mapped_column(Float)

    # Limits
    soc_min_pct: Mapped[float] = mapped_column(Float, default=10.0)
    soc_max_pct: Mapped[float] = mapped_column(Float, default=90.0)

    # Current state
    soc_pct: Mapped[float] = mapped_column(Float, default=50.0)
    current_power_kw: Mapped[float] = mapped_column(Float, default=0.0)  # +charge / -discharge
    is_active: Mapped[bool] = mapped_column(default=True)
