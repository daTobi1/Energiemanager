from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Forecast(Base):
    """Prognosedaten (PV-Erzeugung, Lastprognose, Wärme-/Kältebedarf)."""

    __tablename__ = "forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    forecast_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    forecast_type: Mapped[str] = mapped_column(String(50), index=True)  # pv, load, heat, cold
    value_kw: Mapped[float] = mapped_column(Float)
    confidence_lower_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_upper_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_version: Mapped[str] = mapped_column(String(50), default="rule_based_v1")
