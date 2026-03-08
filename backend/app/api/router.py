from fastapi import APIRouter

from app.api.endpoints import charging, dashboard, generators, storage

api_router = APIRouter()
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(generators.router, prefix="/generators", tags=["Generators"])
api_router.include_router(storage.router, prefix="/storage", tags=["Storage"])
api_router.include_router(charging.router, prefix="/charging", tags=["Charging"])
