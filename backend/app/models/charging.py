import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ChargingMode(str, enum.Enum):
    MAX_SPEED = "max_speed"          # Modus 1: Maximale Ladeleistung
    PV_SURPLUS = "pv_surplus"        # Modus 2: Nur PV-Überschuss
    TARGET_CHARGE = "target_charge"  # Modus 3: Zielladung+PV-Überschuss


class SessionStatus(str, enum.Enum):
    PENDING = "pending"
    CHARGING = "charging"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Wallbox(Base, TimestampMixin):
    __tablename__ = "wallboxes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    max_power_kw: Mapped[float] = mapped_column(Float)
    min_power_kw: Mapped[float] = mapped_column(Float, default=1.4)  # 6A einphasig
    phases: Mapped[int] = mapped_column(Integer, default=3)
    is_active: Mapped[bool] = mapped_column(default=True)
    connector_type: Mapped[str] = mapped_column(String(50), default="type2")

    sessions: Mapped[list["ChargingSession"]] = relationship(back_populates="wallbox")


class ChargingSession(Base, TimestampMixin):
    __tablename__ = "charging_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wallbox_id: Mapped[int] = mapped_column(ForeignKey("wallboxes.id"))
    wallbox: Mapped["Wallbox"] = relationship(back_populates="sessions")

    mode: Mapped[ChargingMode] = mapped_column(Enum(ChargingMode))
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.PENDING
    )

    # Current state
    current_power_kw: Mapped[float] = mapped_column(Float, default=0.0)
    energy_charged_kwh: Mapped[float] = mapped_column(Float, default=0.0)

    # Vehicle info
    vehicle_battery_capacity_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    vehicle_soc_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    vehicle_efficiency_kwh_per_km: Mapped[float] = mapped_column(Float, default=0.167)  # ~6km/kWh

    # Target charge + PV surplus (Modus 3) fields
    target_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    target_energy_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Timestamps
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
