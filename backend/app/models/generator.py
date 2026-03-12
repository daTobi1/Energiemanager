import enum

from sqlalchemy import Enum, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class GeneratorType(str, enum.Enum):
    PV = "pv"
    HEAT_PUMP = "heat_pump"
    CHP = "chp"  # BHKW
    BOILER = "boiler"
    CHILLER = "chiller"
    GRID = "grid"


class EnergyForm(str, enum.Enum):
    ELECTRICITY = "electricity"
    HEAT = "heat"
    COLD = "cold"


class Generator(Base, TimestampMixin):
    __tablename__ = "generators"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[GeneratorType] = mapped_column(Enum(GeneratorType))
    energy_form: Mapped[EnergyForm] = mapped_column(Enum(EnergyForm))

    # Technical specs
    max_power_kw: Mapped[float] = mapped_column(Float)
    min_power_kw: Mapped[float] = mapped_column(Float, default=0.0)
    efficiency: Mapped[float] = mapped_column(Float, default=1.0)

    # Current state
    is_active: Mapped[bool] = mapped_column(default=True)
    is_controllable: Mapped[bool] = mapped_column(default=True)
    current_power_kw: Mapped[float] = mapped_column(Float, default=0.0)
