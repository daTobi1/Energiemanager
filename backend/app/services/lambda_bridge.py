"""
Lambda Bridge — Verbindet Lambda-HP-Treiber mit DAQ und Controller.

Orchestriert:
1. Modbus-Verbindung zum Gerät
2. Periodisches Lesen → Messwerte in DB
3. Controller-Stellgrößen → Modbus-Schreiben
4. PV-Überschuss-Weiterleitung
"""

import asyncio
import logging
from datetime import datetime, timezone

from app.api.websocket import broadcast
from app.core.database import async_session
from app.models.measurement import Measurement

logger = logging.getLogger(__name__)

POLL_INTERVAL = 30   # Lese-Intervall (s) — Lambda-Standard
WRITE_INTERVAL = 9   # PV-Schreib-Intervall (s) — vermeidet Timing-Kollision


class LambdaBridge:
    """Brücke zwischen Lambda-HP-Treiber und dem Energiemanager-System."""

    def __init__(self):
        self._connector = None
        self._running = False
        self._poll_task: asyncio.Task | None = None
        self._pv_surplus_task: asyncio.Task | None = None
        self._pv_surplus_w: int = 0
        self._auto_pv_surplus = False  # Automatisch aus Simulator/Controller

    @property
    def status(self) -> dict:
        if not self._connector:
            return {"connected": False, "running": False}

        info = self._connector.info
        info["running"] = self._running
        info["auto_pv_surplus"] = self._auto_pv_surplus
        info["current_pv_surplus_w"] = self._pv_surplus_w
        return info

    @property
    def modules(self) -> dict:
        if not self._connector:
            return {"error": "Nicht verbunden"}
        return {
            "heat_pumps": self._connector.modules.heat_pumps,
            "boilers": self._connector.modules.boilers,
            "buffers": self._connector.modules.buffers,
            "solar_modules": self._connector.modules.solar_modules,
            "heating_circuits": self._connector.modules.heating_circuits,
        }

    async def connect(self, host: str, port: int = 502, slave_id: int = 1) -> dict:
        """Verbindung herstellen, Module erkennen, Polling starten."""
        from app.drivers.lambda_hp import LambdaHPConnector

        # Bestehende Verbindung trennen
        if self._connector:
            await self.disconnect()

        connector = LambdaHPConnector(host, port, slave_id)
        connected = await connector.connect()

        if not connected:
            return {"success": False, "error": "Verbindung fehlgeschlagen"}

        self._connector = connector
        self._running = True

        # Polling starten
        self._poll_task = asyncio.create_task(self._poll_loop())

        return {
            "success": True,
            "modules": self.modules,
            "info": connector.info,
        }

    async def disconnect(self):
        """Verbindung trennen und Tasks stoppen."""
        self._running = False

        if self._poll_task:
            self._poll_task.cancel()
            self._poll_task = None

        if self._pv_surplus_task:
            self._pv_surplus_task.cancel()
            self._pv_surplus_task = None

        if self._connector:
            await self._connector.disconnect()
            self._connector = None

    async def read_all(self) -> dict:
        """Alle Werte lesen und zurückgeben."""
        if not self._connector:
            return {"error": "Nicht verbunden"}

        values = await self._connector.read_values()
        return {"values": values, "timestamp": datetime.now(timezone.utc).isoformat()}

    async def write(self, key: str, value: float) -> bool:
        """Stellwert schreiben."""
        if not self._connector:
            return False
        return await self._connector.write_setpoint(key, value)

    def set_pv_surplus(self, watts: int):
        """Setzt PV-Überschuss für periodisches Schreiben."""
        self._pv_surplus_w = watts

    def enable_auto_pv_surplus(self, enabled: bool = True):
        """Aktiviert automatische PV-Überschuss-Weiterleitung."""
        self._auto_pv_surplus = enabled
        if enabled and not self._pv_surplus_task and self._running:
            self._pv_surplus_task = asyncio.create_task(self._pv_surplus_loop())
        elif not enabled and self._pv_surplus_task:
            self._pv_surplus_task.cancel()
            self._pv_surplus_task = None

    # ── Controller-Integration ───────────────────────────────────────

    async def apply_setpoints(self, setpoints) -> dict:
        """
        Wendet Controller-Stellgrößen auf die Lambda WP an.

        Mappt Energiemanager-Setpoints auf Lambda-Register:
        - hp_thermal_kw → PV-Überschuss (indirekte Steuerung)
        - flow_temp_c → Vorlauf-Solltemperatur
        - boiler → WW-Solltemperatur
        """
        if not self._connector:
            return {"error": "Nicht verbunden"}

        results = {}

        # Vorlauftemperatur setzen
        if hasattr(setpoints, "flow_temp_c") and setpoints.flow_temp_c > 0:
            ok = await self._connector.write_setpoint(
                "hp_requested_flow_temp_c", setpoints.flow_temp_c
            )
            results["flow_temp_c"] = {"success": ok, "value": setpoints.flow_temp_c}

        # PV-Überschuss berechnen (aus Batterie + Netz-Balance)
        # Die Lambda WP nutzt Register 102 um ihre Leistung anzupassen
        if hasattr(setpoints, "hp_thermal_kw") and setpoints.hp_thermal_kw > 0:
            # Rough estimate: wenn der Optimizer WP-Leistung will,
            # signalisieren wir das als "verfügbare Überschuss-Leistung"
            surplus_w = int(setpoints.hp_thermal_kw * 1000)
            ok = await self._connector.write_setpoint("pv_surplus_w", surplus_w)
            results["pv_surplus_w"] = {"success": ok, "value": surplus_w}

        return results

    # ── Interne Loops ────────────────────────────────────────────────

    async def _poll_loop(self):
        """Periodisches Lesen und Speichern der Messwerte."""
        try:
            while self._running:
                try:
                    await self._connector.read_values()
                    measurements = self._connector.get_measurements()

                    if measurements:
                        await self._store_measurements(measurements)
                except Exception as e:
                    logger.warning("Lambda Poll-Fehler: %s", e)

                await asyncio.sleep(POLL_INTERVAL)
        except asyncio.CancelledError:
            pass

    async def _pv_surplus_loop(self):
        """Schreibt PV-Überschuss periodisch an die WP."""
        try:
            while self._running and self._auto_pv_surplus:
                try:
                    if self._connector and self._pv_surplus_w != 0:
                        await self._connector.write_pv_surplus(self._pv_surplus_w)
                except Exception as e:
                    logger.warning("Lambda PV-Surplus Schreibfehler: %s", e)

                await asyncio.sleep(WRITE_INTERVAL)
        except asyncio.CancelledError:
            pass

    async def _store_measurements(
        self,
        measurements: list[tuple[str, str, float, str]],
    ):
        """Schreibt Messwerte in DB und broadcastet via WebSocket."""
        now = datetime.now(timezone.utc)

        async with async_session() as db:
            for source, metric, value, unit in measurements:
                db.add(Measurement(
                    timestamp=now,
                    source=source,
                    metric=metric,
                    value=value,
                    unit=unit,
                ))
            await db.commit()

        # WebSocket broadcast
        ws_data = {
            "type": "measurements",
            "timestamp": now.isoformat(),
            "source": "lambda_hp",
            "data": {
                f"{source}.{metric}": value
                for source, metric, value, _ in measurements
            },
        }
        await broadcast(ws_data)


# Singleton
lambda_bridge = LambdaBridge()
