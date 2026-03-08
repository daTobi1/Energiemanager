from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.storage import EnergyStorage
from app.schemas.storage import StorageCreate, StorageResponse

router = APIRouter()


@router.get("", response_model=list[StorageResponse])
async def list_storage(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EnergyStorage))
    return result.scalars().all()


@router.post("", response_model=StorageResponse, status_code=201)
async def create_storage(data: StorageCreate, db: AsyncSession = Depends(get_db)):
    storage = EnergyStorage(**data.model_dump())
    db.add(storage)
    await db.flush()
    await db.refresh(storage)
    return storage


@router.get("/{storage_id}", response_model=StorageResponse)
async def get_storage(storage_id: int, db: AsyncSession = Depends(get_db)):
    storage = await db.get(EnergyStorage, storage_id)
    if not storage:
        raise HTTPException(status_code=404, detail="Storage not found")
    return storage
