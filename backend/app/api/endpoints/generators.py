from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.generator import Generator
from app.schemas.generator import GeneratorControl, GeneratorCreate, GeneratorResponse

router = APIRouter()


@router.get("", response_model=list[GeneratorResponse])
async def list_generators(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Generator))
    return result.scalars().all()


@router.post("", response_model=GeneratorResponse, status_code=201)
async def create_generator(data: GeneratorCreate, db: AsyncSession = Depends(get_db)):
    generator = Generator(**data.model_dump())
    db.add(generator)
    await db.flush()
    await db.refresh(generator)
    return generator


@router.get("/{generator_id}", response_model=GeneratorResponse)
async def get_generator(generator_id: int, db: AsyncSession = Depends(get_db)):
    generator = await db.get(Generator, generator_id)
    if not generator:
        raise HTTPException(status_code=404, detail="Generator not found")
    return generator


@router.post("/{generator_id}/control", response_model=GeneratorResponse)
async def control_generator(
    generator_id: int, control: GeneratorControl, db: AsyncSession = Depends(get_db)
):
    generator = await db.get(Generator, generator_id)
    if not generator:
        raise HTTPException(status_code=404, detail="Generator not found")
    if not generator.is_controllable:
        raise HTTPException(status_code=400, detail="Generator is not controllable")

    if control.target_power_kw is not None:
        if control.target_power_kw < generator.min_power_kw:
            raise HTTPException(status_code=400, detail="Power below minimum")
        if control.target_power_kw > generator.max_power_kw:
            raise HTTPException(status_code=400, detail="Power exceeds maximum")
        generator.current_power_kw = control.target_power_kw

    if control.is_active is not None:
        generator.is_active = control.is_active

    await db.flush()
    await db.refresh(generator)
    return generator
