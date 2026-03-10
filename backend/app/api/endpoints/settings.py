from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.config import SystemSettingsConfig

router = APIRouter()


@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db)):
    settings = await db.get(SystemSettingsConfig, "default")
    if not settings:
        return None
    return settings.data


@router.put("")
async def update_settings(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.json()
    settings = await db.get(SystemSettingsConfig, "default")
    if settings:
        settings.data = payload
    else:
        settings = SystemSettingsConfig(id="default", data=payload)
        db.add(settings)
    await db.flush()
    return payload
