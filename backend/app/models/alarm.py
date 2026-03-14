"""
Alarm-Modelle — Alarm-Definitionen und Alarm-Events.

AlarmConfig: Benutzerdefinierte Alarm-Regeln (JSONB, wie andere Configs)
AlarmEvent: Ausgeloeste Alarm-Ereignisse (Zeitreihe)
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AlarmConfig(Base, TimestampMixin):
    """Alarm-Definition (Regel). Wird vom AlarmManager periodisch geprueft."""
    __tablename__ = "alarm_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class AlarmEvent(Base):
    """Ein ausgeloestes Alarm-Ereignis."""
    __tablename__ = "alarm_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True,
    )
    alarm_id: Mapped[str] = mapped_column(String(36), index=True)
    severity: Mapped[str] = mapped_column(String(20))  # info, warning, critical
    message: Mapped[str] = mapped_column(String(500))
    source: Mapped[str] = mapped_column(String(100), index=True)
    metric: Mapped[str] = mapped_column(String(100))
    threshold_value: Mapped[float] = mapped_column(Float, default=0)
    actual_value: Mapped[float] = mapped_column(Float, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    cleared_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
