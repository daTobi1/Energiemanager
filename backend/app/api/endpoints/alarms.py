"""
Alarm API — Alarm-Events, Quittierung und System-Alarme.

Endpoints:
- GET  /alarms/events           — Alle Alarm-Events (Historie)
- GET  /alarms/events/active    — Nur aktive Alarme
- POST /alarms/events/{id}/acknowledge — Alarm quittieren
- POST /alarms/events/{id}/clear       — Alarm manuell loeschen
- GET  /alarms/status           — AlarmManager-Status
- POST /alarms/start            — AlarmManager starten
- POST /alarms/stop             — AlarmManager stoppen
- POST /alarms/evaluate         — Manuell Alarm-Auswertung triggern
- GET  /alarms/system-rules     — Vordefinierte System-Alarme anzeigen
"""

from fastapi import APIRouter, Query

from app.services.alarm_manager import alarm_manager, SYSTEM_ALARMS

router = APIRouter()


@router.get("/events")
async def get_alarm_events(last: int = Query(100, ge=1, le=1000)):
    """Alle Alarm-Events (neueste zuerst)."""
    return await alarm_manager.get_event_history(last)


@router.get("/events/active")
async def get_active_alarms():
    """Nur aktive (nicht geloeschte) Alarm-Events."""
    return await alarm_manager.get_active_events()


@router.post("/events/{event_id}/acknowledge")
async def acknowledge_alarm(event_id: int):
    """Quittiert ein Alarm-Event (bleibt aktiv, aber als gesehen markiert)."""
    ok = await alarm_manager.acknowledge_event(event_id)
    return {"success": ok, "event_id": event_id}


@router.post("/events/{event_id}/clear")
async def clear_alarm(event_id: int):
    """Loescht ein Alarm-Event manuell (setzt is_active=False)."""
    ok = await alarm_manager.clear_event(event_id)
    return {"success": ok, "event_id": event_id}


@router.get("/status")
async def alarm_status():
    """Status des AlarmManagers."""
    return alarm_manager.status


@router.post("/start")
async def start_alarm_manager(interval: int = Query(30, ge=5, le=300)):
    """Startet die periodische Alarm-Auswertung."""
    await alarm_manager.start(interval)
    return alarm_manager.status


@router.post("/stop")
async def stop_alarm_manager():
    """Stoppt die Alarm-Auswertung."""
    await alarm_manager.stop()
    return {"stopped": True}


@router.post("/evaluate")
async def evaluate_alarms():
    """Manuell alle Alarm-Regeln auswerten."""
    triggered = await alarm_manager.evaluate_all()
    return {"triggered": len(triggered), "alarms": triggered}


@router.get("/system-rules")
async def get_system_rules():
    """Zeigt die vordefinierten System-Alarme an."""
    return SYSTEM_ALARMS
