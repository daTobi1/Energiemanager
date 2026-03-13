"""
Optimierer-Endpoints.

GET /optimizer/schedule  — Fahrplan erstellen (24-48h)
"""

from fastapi import APIRouter, Query

from app.services.optimizer import energy_optimizer

router = APIRouter()


@router.get("/schedule")
async def get_optimization_schedule(
    hours: int = Query(24, ge=1, le=72),
    solver: str = Query("auto", pattern="^(auto|milp|heuristic)$"),
):
    """Erstellt optimierten Einsatzfahrplan. solver: auto|milp|heuristic."""
    return await energy_optimizer.create_schedule(hours, solver=solver)
