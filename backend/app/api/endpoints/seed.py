from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.config import (
    CircuitConfig,
    ConsumerConfig,
    GeneratorConfig,
    MeterConfig,
    RoomConfig,
    StorageConfig,
    SystemSettingsConfig,
)

router = APIRouter()

ALL_CONFIG_MODELS = [
    GeneratorConfig, MeterConfig, ConsumerConfig,
    StorageConfig, RoomConfig, CircuitConfig,
]

ENTITY_MAP = {
    "generators": GeneratorConfig,
    "meters": MeterConfig,
    "consumers": ConsumerConfig,
    "storages": StorageConfig,
    "rooms": RoomConfig,
    "circuits": CircuitConfig,
}


@router.post("/seed", status_code=201)
async def load_seed_data(request: Request, db: AsyncSession = Depends(get_db)):
    """Lade Seed-Daten: lösche bestehende Konfig und ersetze komplett."""
    payload = await request.json()

    # Alles löschen
    for model in ALL_CONFIG_MODELS:
        await db.execute(delete(model))

    # Entitäten einfügen
    for key, model in ENTITY_MAP.items():
        for item in payload.get(key, []):
            db.add(model(id=item["id"], data=item))

    # Settings
    if "settings" in payload:
        await db.execute(delete(SystemSettingsConfig))
        db.add(SystemSettingsConfig(id="default", data=payload["settings"]))

    await db.flush()
    return {"status": "ok", "counts": {k: len(payload.get(k, [])) for k in ENTITY_MAP}}


@router.delete("/all", status_code=204)
async def clear_all_data(db: AsyncSession = Depends(get_db)):
    """Lösche alle Konfigurationsdaten."""
    for model in ALL_CONFIG_MODELS:
        await db.execute(delete(model))
    await db.execute(delete(SystemSettingsConfig))
    return Response(status_code=204)
