from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Measurement(Base):
    """Zeitreihendaten für alle Messwerte. Optimiert für TimescaleDB Hypertable."""

    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    source: Mapped[str] = mapped_column(String(100), index=True)  # z.B. "pv_1", "battery_1"
    metric: Mapped[str] = mapped_column(String(100), index=True)  # z.B. "power_kw", "soc_pct"
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(20))  # z.B. "kW", "%", "°C"
