from fastapi import APIRouter

from app.api.crud import create_crud_router
from app.api.endpoints import alarms, auth, charging, controller, data_acquisition, devices, ml, optimizer, scheduler, seed, self_learning, settings, simulator, thermal, trends, weather
from app.api.websocket import router as ws_router
from app.config import settings as app_settings
from app.models.config import (
    CircuitConfig,
    ConsumerConfig,
    GeneratorConfig,
    MeterConfig,
    RoomConfig,
    StorageConfig,
    TrendDefinitionConfig,
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

# Trend-Definitionen (gespeicherte Ansichten)
api_router.include_router(
    create_crud_router(TrendDefinitionConfig, "TrendDefinition"),
    prefix="/trend-definitions", tags=["Trends"],
)

# Trend-Daten (Zeitreihen-Abfrage)
api_router.include_router(trends.router, prefix="/trends", tags=["Trends"])

# Einstellungen
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])

# Seed-Daten & Reset
api_router.include_router(seed.router, prefix="/data", tags=["Data"])

# Simulator
api_router.include_router(simulator.router, prefix="/simulator", tags=["Simulator"])

# Data Acquisition
api_router.include_router(data_acquisition.router, prefix="/daq", tags=["Data Acquisition"])

# Wetter & PV-Prognose
api_router.include_router(weather.router, prefix="/weather", tags=["Weather"])

# Optimierer
api_router.include_router(optimizer.router, prefix="/optimizer", tags=["Optimizer"])

# Controller (Regelung)
api_router.include_router(controller.router, prefix="/controller", tags=["Controller"])

# ML (Prognose-Korrektur)
api_router.include_router(ml.router, prefix="/ml", tags=["ML"])

# Scheduler (Periodische Optimierung)
api_router.include_router(scheduler.router, prefix="/scheduler", tags=["Scheduler"])

# Selbstlernung (ML Readiness + Passiv/Aktiv-Steuerung)
api_router.include_router(self_learning.router, prefix="/self-learning", tags=["Self-Learning"])

# Thermische Raum-/Kreis-Optimierung
api_router.include_router(thermal.router, prefix="/thermal", tags=["Thermal"])

# Authentifizierung
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])

# Alarme & Benachrichtigungen
api_router.include_router(alarms.router, prefix="/alarms", tags=["Alarms"])

# Alarm-Definitionen (CRUD)
from app.models.alarm import AlarmConfig
api_router.include_router(
    create_crud_router(AlarmConfig, "Alarm"),
    prefix="/alarm-definitions", tags=["Alarms"],
)

# Geraeteverwaltung + Presets
api_router.include_router(devices.router, prefix="/devices", tags=["Devices"])

# Lademanagement (Wallboxen + Sessions)
api_router.include_router(charging.router, prefix="/charging", tags=["Charging"])

# WebSocket (Echtzeit-Updates)
api_router.include_router(ws_router)

# Runtime-Endpoints nur bei PostgreSQL (brauchen alte Modelle mit Enum-Spalten)
if not app_settings.database_url.startswith("sqlite"):
    from app.api.endpoints import dashboard

    api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
