"""
Controller-Endpoints.

GET  /controller/status   — Aktueller Controller-Status
POST /controller/mode     — Modus umschalten (auto/manual/off)
POST /controller/override — Manuellen Override setzen
GET  /controller/history  — Soll-Ist-Vergleich Historie
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services.controller import controller

router = APIRouter()


class ModeRequest(BaseModel):
    mode: str  # "auto" | "manual" | "off"


class OverrideRequest(BaseModel):
    key: str
    value: float


@router.get("/status")
async def get_controller_status():
    """Aktueller Controller-Status mit Modus, Stellgroessen und Abweichung."""
    return controller.status


@router.post("/mode")
async def set_controller_mode(req: ModeRequest):
    """Modus umschalten: auto, manual, off."""
    result = controller.set_mode(req.mode)
    return {"status": result, "mode": controller.mode}


@router.post("/override")
async def set_manual_override(req: OverrideRequest):
    """Manuellen Override setzen (nur im manual-Modus wirksam)."""
    result = controller.set_manual_override(req.key, req.value)
    return {"status": result}


@router.delete("/overrides")
async def clear_overrides():
    """Alle manuellen Overrides loeschen."""
    controller.clear_overrides()
    return {"status": "Overrides geloescht"}


@router.get("/history")
async def get_controller_history(last: int = Query(48, ge=1, le=288)):
    """Soll-Ist-Vergleich Historie (letzte N Eintraege)."""
    history = controller.history
    return {
        "count": len(history),
        "entries": history[-last:],
    }
