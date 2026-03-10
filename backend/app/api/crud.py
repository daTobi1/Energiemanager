"""
Generische CRUD-Router-Factory für Konfigurationsentitäten.

Erstellt einen vollständigen FastAPI-Router (GET list, GET one, POST, PUT, DELETE)
für jede Entitätstabelle mit JSON-data-Spalte.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db


def create_crud_router(model_class, entity_name: str) -> APIRouter:
    router = APIRouter()

    @router.get("")
    async def list_entities(db: AsyncSession = Depends(get_db)):
        result = await db.execute(select(model_class).order_by(model_class.created_at))
        return [row.data for row in result.scalars()]

    @router.get("/{entity_id}")
    async def get_entity(entity_id: str, db: AsyncSession = Depends(get_db)):
        entity = await db.get(model_class, entity_id)
        if not entity:
            raise HTTPException(404, f"{entity_name} not found")
        return entity.data

    @router.post("", status_code=201)
    async def create_entity(request: Request, db: AsyncSession = Depends(get_db)):
        payload = await request.json()
        if "id" not in payload:
            raise HTTPException(422, "Missing 'id' field")
        existing = await db.get(model_class, payload["id"])
        if existing:
            existing.data = payload
            await db.flush()
            return payload
        entity = model_class(id=payload["id"], data=payload)
        db.add(entity)
        await db.flush()
        return payload

    @router.put("/{entity_id}")
    async def update_entity(entity_id: str, request: Request, db: AsyncSession = Depends(get_db)):
        payload = await request.json()
        entity = await db.get(model_class, entity_id)
        if not entity:
            raise HTTPException(404, f"{entity_name} not found")
        entity.data = payload
        await db.flush()
        return payload

    @router.delete("/{entity_id}", status_code=204)
    async def delete_entity(entity_id: str, db: AsyncSession = Depends(get_db)):
        entity = await db.get(model_class, entity_id)
        if not entity:
            raise HTTPException(404, f"{entity_name} not found")
        await db.delete(entity)
        return Response(status_code=204)

    # Unique operation IDs for OpenAPI
    suffix = entity_name.lower()
    list_entities.__name__ = f"list_{suffix}s"
    get_entity.__name__ = f"get_{suffix}"
    create_entity.__name__ = f"create_{suffix}"
    update_entity.__name__ = f"update_{suffix}"
    delete_entity.__name__ = f"delete_{suffix}"

    return router
