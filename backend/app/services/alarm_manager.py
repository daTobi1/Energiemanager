"""
AlarmManager — Periodische Alarm-Auswertung und Benachrichtigung.

Prueft konfigurierte Alarm-Regeln gegen aktuelle Messwerte,
erzeugt/loescht Alarm-Events und broadcastet per WebSocket.

Alarm-Typen:
- threshold:    Schwellwert-Ueberschreitung (z.B. Temp > 85°C)
- device_offline: Geraet meldet sich nicht mehr
- system_error:   Scheduler/Controller/Simulator Fehler

Alarm-Lifecycle:
  TRIGGERED → ACTIVE → ACKNOWLEDGED → CLEARED
  TRIGGERED → ACTIVE → AUTO-CLEARED (wenn Bedingung nicht mehr zutrifft)
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import select, and_

from app.api.websocket import broadcast
from app.core.database import async_session
from app.models.alarm import AlarmConfig, AlarmEvent
from app.models.measurement import Measurement

logger = logging.getLogger(__name__)

# Cooldown-Tracking: alarm_id → letzter Trigger-Zeitpunkt
_cooldowns: dict[str, datetime] = {}

# System-Alarme (vordefiniert, nicht vom Benutzer loeschbar)
SYSTEM_ALARMS = [
    {
        "id": "sys_frost_protection",
        "name": "Frostschutz",
        "enabled": True,
        "severity": "critical",
        "triggerType": "threshold",
        "source": "room_*",
        "metric": "temperature_c",
        "condition": "<",
        "threshold": 8.0,
        "description": "Raumtemperatur unter 8°C — Frostgefahr",
        "cooldownMinutes": 5,
        "system": True,
    },
    {
        "id": "sys_storage_overtemp",
        "name": "Speicher Uebertemperatur",
        "enabled": True,
        "severity": "critical",
        "triggerType": "threshold",
        "source": "heat_storage",
        "metric": "temperature_c",
        "condition": ">",
        "threshold": 85.0,
        "description": "Waermespeicher ueber 85°C — Sicherheitsabschaltung",
        "cooldownMinutes": 5,
        "system": True,
    },
    {
        "id": "sys_battery_low",
        "name": "Batterie kritisch niedrig",
        "enabled": True,
        "severity": "warning",
        "triggerType": "threshold",
        "source": "battery",
        "metric": "soc_pct",
        "condition": "<",
        "threshold": 5.0,
        "description": "Batterie-SOC unter 5% — Tiefentladeschutz aktiv",
        "cooldownMinutes": 15,
        "system": True,
    },
    {
        "id": "sys_battery_full",
        "name": "Batterie voll",
        "enabled": True,
        "severity": "info",
        "triggerType": "threshold",
        "source": "battery",
        "metric": "soc_pct",
        "condition": ">",
        "threshold": 98.0,
        "description": "Batterie-SOC ueber 98% — Ladung gestoppt",
        "cooldownMinutes": 30,
        "system": True,
    },
]


class AlarmManager:
    """Verwaltet Alarm-Regeln und prueft sie periodisch."""

    def __init__(self):
        self._running = False
        self._task: asyncio.Task | None = None
        self._eval_interval = 30  # Sekunden

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self, interval: int = 30):
        """Startet die periodische Alarm-Auswertung."""
        if self._running:
            return
        self._eval_interval = interval
        self._running = True
        self._task = asyncio.create_task(self._eval_loop())
        logger.info("AlarmManager gestartet (Intervall: %ds)", interval)

    async def stop(self):
        """Stoppt die Alarm-Auswertung."""
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("AlarmManager gestoppt")

    async def _eval_loop(self):
        """Periodische Auswertung aller Alarm-Regeln."""
        try:
            while self._running:
                try:
                    await self.evaluate_all()
                except Exception:
                    logger.exception("Fehler bei Alarm-Auswertung")
                await asyncio.sleep(self._eval_interval)
        except asyncio.CancelledError:
            pass

    async def evaluate_all(self) -> list[dict]:
        """Prueft alle aktiven Alarm-Regeln gegen aktuelle Messwerte."""
        triggered = []

        # Benutzer-Alarme aus DB laden
        alarm_defs = await self._load_alarm_definitions()

        # System-Alarme hinzufuegen
        for sa in SYSTEM_ALARMS:
            if sa["enabled"]:
                alarm_defs.append(sa)

        # Letzte Messwerte laden
        latest = await self._get_latest_measurements()

        for alarm_def in alarm_defs:
            if not alarm_def.get("enabled", True):
                continue

            trigger_type = alarm_def.get("triggerType", "threshold")

            if trigger_type == "threshold":
                result = await self._check_threshold(alarm_def, latest)
                if result:
                    triggered.append(result)

        # Auto-Clear: aktive Alarme pruefen ob Bedingung noch gilt
        await self._auto_clear_alarms(alarm_defs, latest)

        return triggered

    async def _check_threshold(self, alarm_def: dict, latest: dict) -> dict | None:
        """Prueft einen Schwellwert-Alarm gegen die Messwerte."""
        source_pattern = alarm_def.get("source", "")
        metric = alarm_def.get("metric", "")
        condition = alarm_def.get("condition", ">")
        threshold = alarm_def.get("threshold", 0)
        alarm_id = alarm_def.get("id", "")
        cooldown_min = alarm_def.get("cooldownMinutes", 15)

        # Cooldown pruefen
        if alarm_id in _cooldowns:
            elapsed = (datetime.now(timezone.utc) - _cooldowns[alarm_id]).total_seconds()
            if elapsed < cooldown_min * 60:
                return None

        # Quell-Werte finden (unterstuetzt Wildcards: "room_*")
        matching_values = []
        for key, value in latest.items():
            src, met = key.rsplit(".", 1) if "." in key else (key, "")
            if met != metric:
                continue
            if source_pattern.endswith("*"):
                prefix = source_pattern[:-1]
                if src.startswith(prefix):
                    matching_values.append((src, value))
            elif src == source_pattern:
                matching_values.append((src, value))

        # Bedingung pruefen
        for source, actual_value in matching_values:
            triggered = False
            if condition == ">" and actual_value > threshold:
                triggered = True
            elif condition == "<" and actual_value < threshold:
                triggered = True
            elif condition == ">=" and actual_value >= threshold:
                triggered = True
            elif condition == "<=" and actual_value <= threshold:
                triggered = True
            elif condition == "==" and actual_value == threshold:
                triggered = True

            if triggered:
                _cooldowns[alarm_id] = datetime.now(timezone.utc)
                event = await self._create_event(
                    alarm_def=alarm_def,
                    source=source,
                    metric=metric,
                    threshold=threshold,
                    actual=actual_value,
                )
                return event

        return None

    async def _create_event(
        self,
        alarm_def: dict,
        source: str,
        metric: str,
        threshold: float,
        actual: float,
    ) -> dict:
        """Erstellt ein Alarm-Event und broadcastet es."""
        alarm_id = alarm_def.get("id", "unknown")
        severity = alarm_def.get("severity", "warning")
        condition = alarm_def.get("condition", ">")
        name = alarm_def.get("name", alarm_id)

        message = f"{name}: {source}.{metric} = {actual:.1f} ({condition} {threshold:.1f})"

        # In DB speichern
        async with async_session() as db:
            event = AlarmEvent(
                alarm_id=alarm_id,
                severity=severity,
                message=message,
                source=source,
                metric=metric,
                threshold_value=threshold,
                actual_value=actual,
                is_active=True,
            )
            db.add(event)
            await db.commit()
            await db.refresh(event)
            event_id = event.id

        event_data = {
            "id": event_id,
            "alarm_id": alarm_id,
            "severity": severity,
            "message": message,
            "source": source,
            "metric": metric,
            "threshold": threshold,
            "actual": actual,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # WebSocket broadcast
        await broadcast({
            "type": "alarm",
            **event_data,
        })

        logger.warning("ALARM [%s]: %s", severity.upper(), message)
        return event_data

    async def _auto_clear_alarms(self, alarm_defs: list[dict], latest: dict):
        """Loescht aktive Alarme deren Bedingung nicht mehr zutrifft."""
        now = datetime.now(timezone.utc)

        async with async_session() as db:
            result = await db.execute(
                select(AlarmEvent).where(AlarmEvent.is_active == True)  # noqa: E712
            )
            active_events = list(result.scalars())

            for event in active_events:
                # Alarm-Definition finden
                alarm_def = next(
                    (a for a in alarm_defs if a.get("id") == event.alarm_id),
                    None,
                )
                if not alarm_def:
                    continue

                metric = alarm_def.get("metric", "")
                condition = alarm_def.get("condition", ">")
                threshold = alarm_def.get("threshold", 0)

                # Aktuellen Wert pruefen
                key = f"{event.source}.{metric}"
                if key not in latest:
                    continue

                actual = latest[key]
                still_triggered = False
                if condition == ">" and actual > threshold:
                    still_triggered = True
                elif condition == "<" and actual < threshold:
                    still_triggered = True
                elif condition == ">=" and actual >= threshold:
                    still_triggered = True
                elif condition == "<=" and actual <= threshold:
                    still_triggered = True

                if not still_triggered:
                    event.is_active = False
                    event.cleared_at = now
                    logger.info("ALARM CLEARED: %s", event.message)
                    await broadcast({
                        "type": "alarm_cleared",
                        "id": event.id,
                        "alarm_id": event.alarm_id,
                        "message": event.message,
                        "timestamp": now.isoformat(),
                    })

            await db.commit()

    async def _load_alarm_definitions(self) -> list[dict]:
        """Laedt Benutzer-definierte Alarm-Regeln aus der DB."""
        async with async_session() as db:
            result = await db.execute(select(AlarmConfig))
            return [row.data for row in result.scalars()]

    async def _get_latest_measurements(self) -> dict[str, float]:
        """Holt die jeweils letzten Messwerte pro source.metric."""
        async with async_session() as db:
            # Subquery: max timestamp pro source+metric
            from sqlalchemy import func as sqlfunc
            subq = (
                select(
                    Measurement.source,
                    Measurement.metric,
                    sqlfunc.max(Measurement.timestamp).label("max_ts"),
                )
                .group_by(Measurement.source, Measurement.metric)
                .subquery()
            )

            result = await db.execute(
                select(Measurement)
                .join(
                    subq,
                    and_(
                        Measurement.source == subq.c.source,
                        Measurement.metric == subq.c.metric,
                        Measurement.timestamp == subq.c.max_ts,
                    ),
                )
            )

            return {
                f"{m.source}.{m.metric}": m.value
                for m in result.scalars()
            }

    # ── Manuelle Aktionen ─────────────────────────────────────────────

    async def acknowledge_event(self, event_id: int) -> bool:
        """Quittiert ein Alarm-Event."""
        async with async_session() as db:
            event = await db.get(AlarmEvent, event_id)
            if not event:
                return False
            event.acknowledged_at = datetime.now(timezone.utc)
            await db.commit()
            return True

    async def clear_event(self, event_id: int) -> bool:
        """Loescht/deaktiviert ein Alarm-Event manuell."""
        async with async_session() as db:
            event = await db.get(AlarmEvent, event_id)
            if not event:
                return False
            event.is_active = False
            event.cleared_at = datetime.now(timezone.utc)
            await db.commit()
            return True

    async def get_active_events(self) -> list[dict]:
        """Gibt alle aktiven Alarm-Events zurueck."""
        async with async_session() as db:
            result = await db.execute(
                select(AlarmEvent)
                .where(AlarmEvent.is_active == True)  # noqa: E712
                .order_by(AlarmEvent.timestamp.desc())
            )
            return [
                {
                    "id": e.id,
                    "alarm_id": e.alarm_id,
                    "severity": e.severity,
                    "message": e.message,
                    "source": e.source,
                    "metric": e.metric,
                    "threshold": e.threshold_value,
                    "actual": e.actual_value,
                    "is_active": e.is_active,
                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                    "acknowledged_at": e.acknowledged_at.isoformat() if e.acknowledged_at else None,
                    "cleared_at": e.cleared_at.isoformat() if e.cleared_at else None,
                }
                for e in result.scalars()
            ]

    async def get_event_history(self, last: int = 100) -> list[dict]:
        """Gibt die letzten Alarm-Events zurueck (inkl. geloeschte)."""
        async with async_session() as db:
            result = await db.execute(
                select(AlarmEvent)
                .order_by(AlarmEvent.timestamp.desc())
                .limit(last)
            )
            return [
                {
                    "id": e.id,
                    "alarm_id": e.alarm_id,
                    "severity": e.severity,
                    "message": e.message,
                    "source": e.source,
                    "metric": e.metric,
                    "threshold": e.threshold_value,
                    "actual": e.actual_value,
                    "is_active": e.is_active,
                    "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                    "acknowledged_at": e.acknowledged_at.isoformat() if e.acknowledged_at else None,
                    "cleared_at": e.cleared_at.isoformat() if e.cleared_at else None,
                }
                for e in result.scalars()
            ]

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "eval_interval_s": self._eval_interval,
            "system_alarms": len(SYSTEM_ALARMS),
            "cooldowns_active": len(_cooldowns),
        }


# Singleton
alarm_manager = AlarmManager()
