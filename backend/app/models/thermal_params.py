"""
Gelernte thermische Parameter — Speichert pro Raum die durch ML ermittelten Werte.

Verwendet JSONB-Muster wie die bestehenden Config-Modelle.
Ein Eintrag pro Raum mit gelernten tau, Heizkurven-Parametern etc.
"""

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ThermalLearnedParams(Base, TimestampMixin):
    __tablename__ = "thermal_learned_params"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
