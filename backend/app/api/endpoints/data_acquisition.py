"""API-Endpoints für den Data Acquisition Service."""

from fastapi import APIRouter

from app.services.data_acquisition import data_acquisition

router = APIRouter()


@router.get("/status")
async def get_status():
    """Aktuellen DAQ-Status abfragen: laufend, Targets, Fehler."""
    return data_acquisition.status


@router.post("/start")
async def start_daq():
    """Data Acquisition starten — pollt alle Entities mit aktivierter Kommunikation."""
    if data_acquisition.is_running:
        return {"status": "already_running", **data_acquisition.status}
    await data_acquisition.start()
    return {"status": "started", **data_acquisition.status}


@router.post("/stop")
async def stop_daq():
    """Data Acquisition stoppen."""
    await data_acquisition.stop()
    return {"status": "stopped"}


@router.post("/reload")
async def reload_daq():
    """Konfiguration neu laden (stop + start mit neuer Config)."""
    await data_acquisition.reload_config()
    return {"status": "reloaded", **data_acquisition.status}
