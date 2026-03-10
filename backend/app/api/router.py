from fastapi import APIRouter

from app.api.crud import create_crud_router
from app.api.endpoints import seed, settings
from app.config import settings as app_settings
from app.models.config import (
    CircuitConfig,
    ConsumerConfig,
    GeneratorConfig,
    MeterConfig,
    RoomConfig,
    StorageConfig,
)

api_router = APIRouter()

# Konfiguration — CRUD für alle Entitätstypen
api_router.include_router(
    create_crud_router(GeneratorConfig, "Generator"),
    prefix="/generators", tags=["Generators"],
)
api_router.include_router(
    create_crud_router(MeterConfig, "Meter"),
    prefix="/meters", tags=["Meters"],
)
api_router.include_router(
    create_crud_router(ConsumerConfig, "Consumer"),
    prefix="/consumers", tags=["Consumers"],
)
api_router.include_router(
    create_crud_router(StorageConfig, "Storage"),
    prefix="/storages", tags=["Storages"],
)
api_router.include_router(
    create_crud_router(RoomConfig, "Room"),
    prefix="/rooms", tags=["Rooms"],
)
api_router.include_router(
    create_crud_router(CircuitConfig, "Circuit"),
    prefix="/circuits", tags=["Circuits"],
)

# Einstellungen
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])

# Seed-Daten & Reset
api_router.include_router(seed.router, prefix="/data", tags=["Data"])

# Runtime-Endpoints nur bei PostgreSQL (brauchen alte Modelle mit Enum-Spalten)
if not app_settings.database_url.startswith("sqlite"):
    from app.api.endpoints import charging, dashboard

    api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
    api_router.include_router(charging.router, prefix="/charging", tags=["Charging"])
