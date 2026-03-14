"""
ML-Modell-Status — Verfolgt trainierte Modelle und ihre Metriken.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class MLModelStatus(Base, TimestampMixin):
    __tablename__ = "ml_model_status"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # z.B. "pv_correction"
    model_type: Mapped[str] = mapped_column(String(30), default="xgboost")
    version: Mapped[str] = mapped_column(String(20), default="v1")
    trained_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    training_samples: Mapped[int] = mapped_column(Integer, default=0)
    feature_count: Mapped[int] = mapped_column(Integer, default=0)
    mae: Mapped[float] = mapped_column(Float, default=0.0)
    rmse: Mapped[float] = mapped_column(Float, default=0.0)
    r2_score: Mapped[float] = mapped_column(Float, default=0.0)
    model_path: Mapped[str] = mapped_column(String(200), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    activation_mode: Mapped[str] = mapped_column(String(20), default="passive")
    # "passive" | "active" | "off"
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
