from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.core.database import engine
from app.models.base import Base

# Config-Modelle importieren damit sie bei create_all registriert sind
from app.models import config as _config_models  # noqa: F401
from app.models import ml_status as _ml_models  # noqa: F401
from app.models import thermal_params as _thermal_models  # noqa: F401
from app.models import weather as _weather_models  # noqa: F401
from app.models import alarm as _alarm_models  # noqa: F401
from app.models import charging as _charging_models  # noqa: F401
from app.models import user as _user_models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Config-Tabellen erstellen
    _is_sqlite = settings.database_url.startswith("sqlite")
    if _is_sqlite:
        # SQLite: nur Config-Tabellen erstellen (keine Enum-Spalten)
        config_tables = [
            Base.metadata.tables[t] for t in Base.metadata.tables
            if t in (
                "generator_configs", "meter_configs", "consumer_configs",
                "storage_configs", "room_configs", "circuit_configs", "system_settings",
                "measurements", "trend_definitions", "weather_cache", "ml_model_status",
                "thermal_learned_params",
                "alarm_configs", "alarm_events", "users",
                "vehicles", "wallboxes", "charging_sessions",
            )
        ]
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all, tables=config_tables)
    else:
        # PostgreSQL: alle Tabellen
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    yield
    await engine.dispose()


app = FastAPI(
    title="EnergyManager API",
    description="Intelligentes Energiemanagementsystem",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "database": "sqlite" if settings.database_url.startswith("sqlite") else "postgresql"}
