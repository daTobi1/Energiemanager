import enum
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ChargingMode(str, enum.Enum):
    MAX_SPEED = "max_speed"          # Modus 1: Maximale Ladeleistung
    PV_SURPLUS = "pv_surplus"        # Modus 2: Nur PV-Überschuss
    MIN_PV = "min_pv"               # Modus 3: Mindestleistung + PV-Boost
    TARGET_CHARGE = "target_charge"  # Modus 4: Zielladung+PV-Überschuss


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    CHARGING = "charging"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Vehicle(Base, TimestampMixin):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    brand: Mapped[str] = mapped_column(String(100), default="")
    model: Mapped[str] = mapped_column(String(100), default="")
    license_plate: Mapped[str] = mapped_column(String(20), default="")
    battery_kwh: Mapped[float] = mapped_column(Float, default=60.0)
    consumption_per_100km: Mapped[float] = mapped_column(Float, default=16.7)
    default_soc_limit_pct: Mapped[float] = mapped_column(Float, default=80.0)
    max_ac_power_kw: Mapped[float] = mapped_column(Float, default=11.0)
    connector_type: Mapped[str] = mapped_column(String(50), default="type2")
    color: Mapped[str] = mapped_column(String(30), default="")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    assigned_wallboxes: Mapped[list["Wallbox"]] = relationship(back_populates="assigned_vehicle")
    sessions: Mapped[list["ChargingSession"]] = relationship(back_populates="vehicle")


class Wallbox(Base, TimestampMixin):
    __tablename__ = "wallboxes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    max_power_kw: Mapped[float] = mapped_column(Float)
    min_power_kw: Mapped[float] = mapped_column(Float, default=1.4)  # 6A einphasig
    phases: Mapped[int] = mapped_column(Integer, default=3)
    is_active: Mapped[bool] = mapped_column(default=True)
    connector_type: Mapped[str] = mapped_column(String(50), default="type2")
    consumer_config_id: Mapped[str | None] = mapped_column(String(36), nullable=True, unique=True)
    assigned_vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True)

    assigned_vehicle: Mapped["Vehicle | None"] = relationship(back_populates="assigned_wallboxes")
    sessions: Mapped[list["ChargingSession"]] = relationship(back_populates="wallbox")


class ChargingSession(Base, TimestampMixin):
    __tablename__ = "charging_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wallbox_id: Mapped[int] = mapped_column(ForeignKey("wallboxes.id"))
    wallbox: Mapped["Wallbox"] = relationship(back_populates="sessions")
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True)
    vehicle: Mapped["Vehicle | None"] = relationship(back_populates="sessions")

    # String statt Enum für SQLite-Kompatibilität
    mode: Mapped[str] = mapped_column(String(20), default=ChargingMode.MAX_SPEED.value)
    status: Mapped[str] = mapped_column(String(20), default=SessionStatus.PENDING.value)

    # Current state
    current_power_kw: Mapped[float] = mapped_column(Float, default=0.0)
    energy_charged_kwh: Mapped[float] = mapped_column(Float, default=0.0)

    # Solar/Grid-Aufschlüsselung + Kosten
    solar_energy_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    grid_energy_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    cost_ct: Mapped[float] = mapped_column(Float, default=0.0)

    # Vehicle info
    vehicle_battery_capacity_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    vehicle_soc_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    vehicle_efficiency_kwh_per_km: Mapped[float] = mapped_column(Float, default=0.167)  # ~6km/kWh
    vehicle_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # SoC-Limit (Laden stoppen bei X%)
    soc_limit_pct: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Target charge + PV surplus (Modus 4) fields
    target_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_energy_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Timestamps
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
