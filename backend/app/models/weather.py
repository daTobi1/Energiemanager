"""
Weather-Cache-Modell.

Speichert Open-Meteo-API-Antworten mit TTL, um unnoetige Requests zu vermeiden.
"""

from datetime import datetime

from sqlalchemy import DateTime, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class WeatherCache(Base, TimestampMixin):
    __tablename__ = "weather_cache"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
