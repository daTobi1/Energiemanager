"""
Konfigurationsmodelle für alle Entitätstypen.

Speichern die vollständigen Frontend-JSON-Objekte in JSON(B)-Spalten.
Die Frontend TypeScript-Interfaces sind die kanonische Schema-Definition.

- PostgreSQL: nutzt JSONB (indizierbar, effizient)
- SQLite: nutzt JSON (für lokale Entwicklung ohne Docker)
"""

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class GeneratorConfig(Base, TimestampMixin):
    __tablename__ = "generator_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class MeterConfig(Base, TimestampMixin):
    __tablename__ = "meter_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class ConsumerConfig(Base, TimestampMixin):
    __tablename__ = "consumer_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class StorageConfig(Base, TimestampMixin):
    __tablename__ = "storage_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class RoomConfig(Base, TimestampMixin):
    __tablename__ = "room_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class CircuitConfig(Base, TimestampMixin):
    __tablename__ = "circuit_configs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class SystemSettingsConfig(Base, TimestampMixin):
    __tablename__ = "system_settings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class TrendDefinitionConfig(Base, TimestampMixin):
    __tablename__ = "trend_definitions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
