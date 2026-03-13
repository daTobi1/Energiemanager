"""
Optimierer-Endpoints.

GET /optimizer/schedule  — Fahrplan erstellen (24-48h)
"""

from fastapi import APIRouter, Query

from app.services.optimizer import energy_optimizer

router = APIRouter()


@router.get("/schedule")
async def get_optimization_schedule(hours: int = Query(24, ge=1, le=72)):
    """Erstellt optimierten Einsatzfahrplan fuer die naechsten Stunden."""
    return await energy_optimizer.create_schedule(hours)
