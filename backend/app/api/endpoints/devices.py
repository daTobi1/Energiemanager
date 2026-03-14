"""
Device API — Geraeteverwaltung, Presets und DeviceManager-Steuerung.

Endpoints:
- GET  /devices/presets          — Verfuegbare Geraeteprofile
- GET  /devices/presets/{id}     — Einzelnes Profil (Rohdaten)
- POST /devices/presets/reload   — Presets neu laden
- GET  /devices/status           — DeviceManager-Status
- GET  /devices/{id}/status      — Status eines Geraets
- GET  /devices/{id}/values      — Aktuelle Messwerte
- POST /devices/{id}/write       — Stellwert schreiben
- POST /devices/start            — DeviceManager starten
- POST /devices/stop             — DeviceManager stoppen
- POST /devices/reload           — Konfiguration neu laden
"""

from fastapi import APIRouter, HTTPException, Query

from app.drivers.presets import get_preset_raw, list_presets, reload_presets
from app.services.device_manager import device_manager

router = APIRouter()


# ── Presets ───────────────────────────────────────────────────────────


@router.get("/presets")
async def get_presets(category: str | None = None):
    """Listet alle verfuegbaren Geraeteprofile auf."""
    return list_presets(category)


@router.get("/presets/{preset_id}")
async def get_preset_detail(preset_id: str):
    """Gibt die vollstaendigen Rohdaten eines Presets zurueck."""
    data = get_preset_raw(preset_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Preset '{preset_id}' nicht gefunden")
    return data


@router.post("/presets/reload")
async def reload_all_presets():
    """Laedt alle Presets aus den JSON-Dateien neu."""
    reload_presets()
    presets = list_presets()
    return {"reloaded": len(presets), "presets": presets}


# ── DeviceManager Steuerung ──────────────────────────────────────────


@router.get("/status")
async def get_device_manager_status():
    """Status des DeviceManagers mit allen verwalteten Geraeten."""
    return device_manager.status


@router.post("/start")
async def start_device_manager():
    """Startet den DeviceManager (scannt Entities, verbindet Geraete)."""
    await device_manager.start()
    return device_manager.status


@router.post("/stop")
async def stop_device_manager():
    """Stoppt den DeviceManager und trennt alle Verbindungen."""
    await device_manager.stop()
    return {"stopped": True}


@router.post("/reload")
async def reload_device_manager():
    """Laedt Konfiguration neu (Entity-Aenderungen uebernehmen)."""
    await device_manager.reload()
    return device_manager.status


# ── Einzelne Geraete ─────────────────────────────────────────────────


@router.get("/{entity_id}/status")
async def get_device_status(entity_id: str):
    """Status eines einzelnen verwalteten Geraets."""
    status = device_manager.get_device_status(entity_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Geraet '{entity_id}' nicht registriert")
    return status


@router.get("/{entity_id}/values")
async def get_device_values(entity_id: str):
    """Aktuelle Messwerte eines Geraets."""
    values = device_manager.get_device_values(entity_id)
    if values is None:
        raise HTTPException(status_code=404, detail=f"Geraet '{entity_id}' nicht registriert")
    return {"entity_id": entity_id, "values": values, "count": len(values)}


@router.post("/{entity_id}/write")
async def write_device_setpoint(entity_id: str, key: str = Query(...), value: float = Query(...)):
    """
    Schreibt einen Stellwert an ein Geraet.

    Der Key muss im write_map des Presets definiert sein.
    Beispiele: pv_surplus_w, boiler_target_temp_c, hp_requested_flow_temp_c
    """
    status = device_manager.get_device_status(entity_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Geraet '{entity_id}' nicht registriert")
    if not status["connected"]:
        raise HTTPException(status_code=503, detail="Geraet nicht verbunden")

    success = await device_manager.write_setpoint(entity_id, key, value)
    return {"success": success, "key": key, "value": value}
