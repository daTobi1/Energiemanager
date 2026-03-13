"""
Lambda Wärmepumpe — API-Endpoints.

Verbindung, Status, Module, Lesen und Schreiben über Modbus TCP.
"""

from fastapi import APIRouter, Query

from app.services.lambda_bridge import lambda_bridge

router = APIRouter()


@router.get("/status")
async def get_status():
    """Status der Lambda-Verbindung und erkannter Module."""
    return lambda_bridge.status


@router.post("/connect")
async def connect(
    host: str = Query(..., description="IP-Adresse der Lambda WP"),
    port: int = Query(502, description="Modbus TCP Port"),
    slave_id: int = Query(1, description="Modbus Slave ID"),
):
    """Verbindung zur Lambda WP herstellen und Module erkennen."""
    result = await lambda_bridge.connect(host, port, slave_id)
    return result


@router.post("/disconnect")
async def disconnect():
    """Verbindung trennen."""
    await lambda_bridge.disconnect()
    return {"status": "disconnected"}


@router.get("/values")
async def read_values():
    """Alle aktuellen Werte der Lambda-Anlage lesen."""
    values = await lambda_bridge.read_all()
    return values


@router.post("/write")
async def write_setpoint(
    key: str = Query(..., description="Stellgröße (z.B. pv_surplus_w, boiler_target_temp_c)"),
    value: float = Query(..., description="Wert"),
):
    """Stellwert an die Lambda WP schreiben."""
    success = await lambda_bridge.write(key, value)
    return {"success": success, "key": key, "value": value}


@router.post("/pv-surplus")
async def write_pv_surplus(
    watts: int = Query(..., description="PV-Überschuss in Watt"),
):
    """PV-Überschuss an den Lambda E-Manager senden (Register 102)."""
    success = await lambda_bridge.write("pv_surplus_w", watts)
    return {"success": success, "watts": watts}


@router.get("/modules")
async def get_modules():
    """Erkannte Module der Lambda-Anlage."""
    return lambda_bridge.modules
