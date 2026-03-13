"""
Data Acquisition Service — Pollt echte Hardware über konfigurierte Protokolle.

Liest die CommunicationConfig jeder Entity (Erzeuger, Zähler, Speicher, etc.),
pollt die konfigurierten Datenpunkte im eingestellten Intervall und schreibt
die Messwerte in die measurements-Tabelle.

Unterstützte Protokolle:
- Modbus TCP (pymodbus)
- MQTT (paho-mqtt, Subscribe-basiert)
- HTTP REST (httpx)
"""

import asyncio
import json
import logging
import re
import struct
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.api.websocket import broadcast
from app.core.database import async_session
from app.models.config import (
    ConsumerConfig,
    GeneratorConfig,
    MeterConfig,
    StorageConfig,
)
from app.models.measurement import Measurement

logger = logging.getLogger(__name__)


# ── Protokoll-Handler ──────────────────────────────────────────────────


class ModbusHandler:
    """Liest Register über Modbus TCP."""

    def __init__(self):
        self._clients: dict[str, Any] = {}  # host:port → client

    async def read(self, comm: dict, data_points: list[dict]) -> list[tuple[str, float, str]]:
        """Liest Datenpunkte via Modbus TCP. Gibt [(metric, value, unit), ...] zurück."""
        from pymodbus.client import AsyncModbusTcpClient

        host = comm.get("ipAddress", "")
        port = comm.get("port", 502)
        if not host:
            return []

        key = f"{host}:{port}"
        client = self._clients.get(key)
        if client is None or not client.connected:
            client = AsyncModbusTcpClient(host, port=port)
            connected = await client.connect()
            if not connected:
                logger.warning("Modbus: Verbindung zu %s fehlgeschlagen", key)
                return []
            self._clients[key] = client

        modbus_cfg = comm.get("modbus", {})
        unit_id = modbus_cfg.get("unitId", 1)

        results = []
        for dp in data_points:
            try:
                addr = dp.get("registerAddress", 0)
                count = dp.get("registerCount", 2)
                reg_type = dp.get("registerType", "holding")
                data_type = dp.get("dataType", "float32")
                scale = dp.get("scaleFactor", 1.0)
                byte_order = dp.get("byteOrder", "big_endian")

                if reg_type == "input":
                    resp = await client.read_input_registers(addr, count, slave=unit_id)
                else:
                    resp = await client.read_holding_registers(addr, count, slave=unit_id)

                if resp.isError():
                    logger.warning("Modbus: Lesefehler Register %d@%s: %s", addr, key, resp)
                    continue

                value = _decode_registers(resp.registers, data_type, byte_order) * scale
                results.append((dp["metric"], round(value, 4), dp.get("unit", "")))
            except Exception as e:
                logger.warning("Modbus: Fehler bei Register %s@%s: %s", dp.get("metric"), key, e)

        return results

    async def close(self):
        for client in self._clients.values():
            client.close()
        self._clients.clear()


def _decode_registers(registers: list[int], data_type: str, byte_order: str) -> float:
    """Dekodiert Modbus-Register in einen Float-Wert."""
    fmt_endian = ">" if byte_order == "big_endian" else "<"

    # Register (16-bit) zu Bytes
    raw = b""
    for reg in registers:
        raw += struct.pack(">H", reg)  # Register immer big-endian

    if byte_order == "little_endian":
        # Swap register pairs for little-endian word order
        if len(raw) == 4:
            raw = raw[2:4] + raw[0:2]

    type_map = {
        "int16": (fmt_endian + "h", 2),
        "uint16": (fmt_endian + "H", 2),
        "int32": (fmt_endian + "i", 4),
        "uint32": (fmt_endian + "I", 4),
        "float32": (fmt_endian + "f", 4),
        "float64": (fmt_endian + "d", 8),
    }

    fmt, size = type_map.get(data_type, (fmt_endian + "f", 4))
    return struct.unpack(fmt, raw[:size])[0]


class MqttHandler:
    """Empfängt Werte über MQTT (Subscribe-basiert)."""

    def __init__(self):
        self._client = None
        self._values: dict[str, tuple[float, str]] = {}  # topic → (value, unit)
        self._running = False
        self._task: asyncio.Task | None = None

    async def start(self, subscriptions: list[dict]):
        """Startet MQTT-Client und abonniert Topics."""
        if self._running or not subscriptions:
            return

        import paho.mqtt.client as mqtt_client

        # Broker aus erster Subscription ermitteln
        first_comm = subscriptions[0]["comm"]
        broker = first_comm.get("ipAddress", "localhost")
        port = first_comm.get("port", 1883)

        self._client = mqtt_client.Client(
            client_id="energiemanager_daq",
            callback_api_version=mqtt_client.CallbackAPIVersion.VERSION2,
        )

        def on_message(client, userdata, msg):
            try:
                payload = msg.payload.decode("utf-8")
                # Subscription-Info suchen
                for sub in subscriptions:
                    mqtt_cfg = sub["comm"].get("mqtt", {})
                    if mqtt_cfg.get("topic") == msg.topic:
                        fmt = mqtt_cfg.get("payloadFormat", "json")
                        if fmt == "json":
                            data = json.loads(payload)
                            json_path = mqtt_cfg.get("valueJsonPath", "$.value")
                            value = _extract_json_path(data, json_path)
                        else:
                            value = float(payload)
                        self._values[msg.topic] = (value, sub.get("unit", ""))
                        break
            except Exception as e:
                logger.warning("MQTT: Fehler beim Parsen von %s: %s", msg.topic, e)

        self._client.on_message = on_message

        try:
            self._client.connect(broker, port)
            for sub in subscriptions:
                topic = sub["comm"].get("mqtt", {}).get("topic", "")
                if topic:
                    self._client.subscribe(topic)
            self._client.loop_start()
            self._running = True
            logger.info("MQTT: Verbunden mit %s:%d, %d Topics", broker, port, len(subscriptions))
        except Exception as e:
            logger.warning("MQTT: Verbindung zu %s:%d fehlgeschlagen: %s", broker, port, e)

    def get_values(self) -> dict[str, tuple[float, str]]:
        """Gibt aktuelle MQTT-Werte zurück und leert den Buffer."""
        vals = dict(self._values)
        return vals

    async def stop(self):
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None
        self._values.clear()
        self._running = False


class HttpHandler:
    """Liest Werte über HTTP REST."""

    async def read(self, comm: dict, data_points: list[dict]) -> list[tuple[str, float, str]]:
        """Pollt HTTP-Endpoint. Gibt [(metric, value, unit), ...] zurück."""
        import httpx

        http_cfg = comm.get("http", {})
        base_url = http_cfg.get("baseUrl", "")
        endpoint = http_cfg.get("endpoint", "")
        method = http_cfg.get("method", "GET")
        auth_type = http_cfg.get("authType", "none")

        if not base_url:
            return []

        url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}" if endpoint else base_url

        headers = {}
        auth = None
        if auth_type == "bearer":
            headers["Authorization"] = f"Bearer {http_cfg.get('apiKey', '')}"
        elif auth_type == "api_key":
            headers["X-API-Key"] = http_cfg.get("apiKey", "")
        elif auth_type == "basic":
            auth = (http_cfg.get("username", ""), http_cfg.get("password", ""))

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                if method == "POST":
                    resp = await client.post(url, headers=headers, auth=auth)
                else:
                    resp = await client.get(url, headers=headers, auth=auth)
                resp.raise_for_status()
                data = resp.json()
        except Exception as e:
            logger.warning("HTTP: Fehler bei %s: %s", url, e)
            return []

        results = []
        for dp in data_points:
            try:
                json_path = dp.get("responseJsonPath", http_cfg.get("responseJsonPath", "$.value"))
                value = _extract_json_path(data, json_path)
                results.append((dp["metric"], round(float(value), 4), dp.get("unit", "")))
            except Exception as e:
                logger.warning("HTTP: Fehler beim Parsen von %s: %s", dp.get("metric"), e)

        return results


def _extract_json_path(data: Any, path: str) -> float:
    """Einfacher JSONPath-Extraktor ($.key.subkey oder $.key[0])."""
    path = path.lstrip("$").lstrip(".")
    obj = data
    for part in path.split("."):
        if not part:
            continue
        # Array-Index: key[0]
        match = re.match(r"(\w+)\[(\d+)\]", part)
        if match:
            key, idx = match.group(1), int(match.group(2))
            obj = obj[key][idx]
        elif isinstance(obj, dict):
            obj = obj[part]
        elif isinstance(obj, list):
            obj = obj[int(part)]
        else:
            raise ValueError(f"Kann '{part}' nicht auflösen in {type(obj)}")
    return float(obj)


# ── Data Acquisition Service ───────────────────────────────────────────


def _slugify(name: str) -> str:
    """Wandelt Entity-Name in source-kompatiblen Slug um."""
    s = name.lower().strip()
    s = re.sub(r"[äÄ]", "ae", s)
    s = re.sub(r"[öÖ]", "oe", s)
    s = re.sub(r"[üÜ]", "ue", s)
    s = re.sub(r"[ß]", "ss", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def _get_data_points(entity: dict, entity_type: str) -> list[dict]:
    """Ermittelt die abzufragenden Datenpunkte für eine Entity.

    Für Zähler: registerMappings definieren die Datenpunkte.
    Für andere: Standard-Datenpunkte je nach Typ.
    """
    comm = entity.get("communication", {})
    protocol = comm.get("protocol", "")

    # Zähler haben explizite registerMappings
    if entity_type == "meter":
        mappings = entity.get("registerMappings", [])
        if mappings:
            return [
                {
                    "metric": m.get("name", "value"),
                    "unit": m.get("unit", ""),
                    "registerAddress": m.get("registerAddress", 0),
                    "registerCount": 2,
                    "registerType": "holding",
                    "dataType": m.get("dataType", "float32"),
                    "scaleFactor": m.get("scaleFactor", 1.0),
                    "responseJsonPath": f"$.{m.get('name', 'value')}",
                }
                for m in mappings
            ]
        # Fallback: ein Wert
        return [{"metric": "power_kw", "unit": "kW", "registerAddress": 0, "registerCount": 2,
                 "registerType": "holding", "dataType": "float32", "scaleFactor": 1.0,
                 "responseJsonPath": "$.value"}]

    # Standard-Datenpunkte je Entity-Typ
    type_points = {
        # Generators
        "pv": [
            {"metric": "power_kw", "unit": "kW"},
            {"metric": "energy_kwh", "unit": "kWh"},
        ],
        "wind_turbine": [
            {"metric": "power_kw", "unit": "kW"},
            {"metric": "energy_kwh", "unit": "kWh"},
        ],
        "heat_pump": [
            {"metric": "power_kw", "unit": "kW"},
            {"metric": "heat_kw", "unit": "kW"},
            {"metric": "cop", "unit": ""},
        ],
        "boiler": [
            {"metric": "heat_kw", "unit": "kW"},
            {"metric": "modulation_pct", "unit": "%"},
        ],
        "chp": [
            {"metric": "power_kw", "unit": "kW"},
            {"metric": "heat_kw", "unit": "kW"},
        ],
        "chiller": [
            {"metric": "power_kw", "unit": "kW"},
            {"metric": "cold_kw", "unit": "kW"},
        ],
        "grid": [
            {"metric": "power_kw", "unit": "kW"},
            {"metric": "import_kwh", "unit": "kWh"},
            {"metric": "export_kwh", "unit": "kWh"},
        ],
        # Storages
        "battery": [
            {"metric": "power_kw", "unit": "kW"},
            {"metric": "soc_pct", "unit": "%"},
        ],
        "heat": [
            {"metric": "temperature_c", "unit": "°C"},
        ],
        "cold": [
            {"metric": "temperature_c", "unit": "°C"},
        ],
    }

    entity_sub_type = entity.get("type", "")
    points = type_points.get(entity_sub_type, [{"metric": "value", "unit": ""}])

    # Modbus-spezifische Felder aus der globalen Modbus-Config übernehmen
    if protocol == "modbus_tcp":
        modbus = comm.get("modbus", {})
        base_addr = modbus.get("registerAddress", 0)
        for i, p in enumerate(points):
            p.setdefault("registerAddress", base_addr + i * 2)
            p.setdefault("registerCount", modbus.get("registerCount", 2))
            p.setdefault("registerType", modbus.get("registerType", "holding"))
            p.setdefault("dataType", modbus.get("dataType", "float32"))
            p.setdefault("scaleFactor", modbus.get("scaleFactor", 1.0))
            p.setdefault("byteOrder", modbus.get("byteOrder", "big_endian"))

    # HTTP: responseJsonPath
    if protocol == "http_rest":
        http_cfg = comm.get("http", {})
        base_path = http_cfg.get("responseJsonPath", "$.value")
        for p in points:
            p.setdefault("responseJsonPath", base_path)

    return points


class DataAcquisitionService:
    """Pollt konfigurierte Hardware und schreibt Messwerte in die DB."""

    def __init__(self):
        self._running = False
        self._tasks: list[asyncio.Task] = []
        self._modbus = ModbusHandler()
        self._mqtt = MqttHandler()
        self._http = HttpHandler()
        self._poll_targets: list[dict] = []
        self._error_counts: dict[str, int] = {}

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "targets": len(self._poll_targets),
            "details": [
                {
                    "source": t["source"],
                    "entity_type": t["entity_type"],
                    "protocol": t["protocol"],
                    "interval_seconds": t["interval"],
                    "data_points": [dp["metric"] for dp in t["data_points"]],
                    "errors": self._error_counts.get(t["source"], 0),
                }
                for t in self._poll_targets
            ],
        }

    async def start(self):
        """Lade Konfiguration und starte Polling-Tasks."""
        if self._running:
            return
        self._running = True
        self._error_counts.clear()

        await self._load_targets()

        if not self._poll_targets:
            logger.warning("DAQ: Keine Entities mit aktivierter Kommunikation gefunden")
            self._running = False
            return

        # MQTT-Subscriptions starten
        mqtt_subs = [
            {"comm": t["comm"], "unit": t["data_points"][0].get("unit", "")}
            for t in self._poll_targets if t["protocol"] == "mqtt"
        ]
        if mqtt_subs:
            await self._mqtt.start(mqtt_subs)

        # Polling-Tasks gruppiert nach Intervall starten
        intervals: dict[int, list[dict]] = {}
        for target in self._poll_targets:
            if target["protocol"] == "mqtt":
                continue  # MQTT ist push-basiert
            iv = target["interval"]
            intervals.setdefault(iv, []).append(target)

        for interval, targets in intervals.items():
            task = asyncio.create_task(self._poll_loop(interval, targets))
            self._tasks.append(task)

        # Separater MQTT-Sammel-Task
        mqtt_targets = [t for t in self._poll_targets if t["protocol"] == "mqtt"]
        if mqtt_targets:
            # MQTT-Werte alle 5 Sekunden in DB schreiben
            task = asyncio.create_task(self._mqtt_collect_loop(mqtt_targets))
            self._tasks.append(task)

        logger.info(
            "DAQ: Gestartet — %d Targets, %d Polling-Tasks, %d MQTT-Topics",
            len(self._poll_targets),
            len([t for t in self._poll_targets if t["protocol"] != "mqtt"]),
            len(mqtt_targets),
        )

    async def stop(self):
        """Stoppt alle Polling-Tasks und schließt Verbindungen."""
        self._running = False
        for task in self._tasks:
            task.cancel()
        self._tasks.clear()
        await self._modbus.close()
        await self._mqtt.stop()
        self._poll_targets.clear()
        logger.info("DAQ: Gestoppt")

    async def reload_config(self):
        """Konfiguration neu laden (z.B. nach Entity-Änderung)."""
        was_running = self._running
        if was_running:
            await self.stop()
            await self.start()

    async def _load_targets(self):
        """Lade alle Entities mit aktivierter Kommunikation."""
        self._poll_targets.clear()

        async with async_session() as db:
            entity_configs = [
                (GeneratorConfig, "generator"),
                (MeterConfig, "meter"),
                (ConsumerConfig, "consumer"),
                (StorageConfig, "storage"),
            ]

            for model, entity_type in entity_configs:
                result = await db.execute(select(model))
                for row in result.scalars():
                    entity = row.data
                    comm = entity.get("communication", {})
                    if not comm.get("enabled", False):
                        continue

                    protocol = comm.get("protocol", "")
                    interval = comm.get("pollingIntervalSeconds", 5)
                    source = _slugify(entity.get("name", entity.get("id", "unknown")))
                    data_points = _get_data_points(entity, entity_type)

                    self._poll_targets.append({
                        "entity_id": entity.get("id", ""),
                        "entity_type": entity_type,
                        "source": source,
                        "protocol": protocol,
                        "interval": interval,
                        "comm": comm,
                        "data_points": data_points,
                    })

    async def _poll_loop(self, interval: int, targets: list[dict]):
        """Polling-Loop für eine Gruppe von Targets mit gleichem Intervall."""
        try:
            while self._running:
                now = datetime.now(timezone.utc)
                measurements: list[tuple[str, str, float, str]] = []

                for target in targets:
                    try:
                        results = await self._poll_single(target)
                        for metric, value, unit in results:
                            measurements.append((target["source"], metric, value, unit))
                    except Exception as e:
                        source = target["source"]
                        self._error_counts[source] = self._error_counts.get(source, 0) + 1
                        logger.warning("DAQ: Fehler bei %s: %s", source, e)

                if measurements:
                    await self._write_measurements(now, measurements)

                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            pass

    async def _poll_single(self, target: dict) -> list[tuple[str, float, str]]:
        """Pollt einen einzelnen Target über das konfigurierte Protokoll."""
        protocol = target["protocol"]
        comm = target["comm"]
        data_points = target["data_points"]

        if protocol == "modbus_tcp" or protocol == "sunspec":
            return await self._modbus.read(comm, data_points)
        elif protocol == "http_rest":
            return await self._http.read(comm, data_points)
        else:
            logger.debug("DAQ: Protokoll '%s' wird noch nicht unterstützt", protocol)
            return []

    async def _mqtt_collect_loop(self, targets: list[dict]):
        """Sammelt MQTT-Werte periodisch und schreibt sie in die DB."""
        try:
            while self._running:
                await asyncio.sleep(5)
                now = datetime.now(timezone.utc)
                values = self._mqtt.get_values()
                if not values:
                    continue

                measurements: list[tuple[str, str, float, str]] = []
                for target in targets:
                    topic = target["comm"].get("mqtt", {}).get("topic", "")
                    if topic in values:
                        value, unit = values[topic]
                        # Erste Metric als Name verwenden
                        metric = target["data_points"][0]["metric"] if target["data_points"] else "value"
                        measurements.append((target["source"], metric, value, unit or target["data_points"][0].get("unit", "")))

                if measurements:
                    await self._write_measurements(now, measurements)
        except asyncio.CancelledError:
            pass

    async def _write_measurements(
        self,
        timestamp: datetime,
        measurements: list[tuple[str, str, float, str]],
    ):
        """Schreibt Messwerte in die DB und broadcastet per WebSocket."""
        async with async_session() as db:
            for source, metric, value, unit in measurements:
                db.add(Measurement(
                    timestamp=timestamp,
                    source=source,
                    metric=metric,
                    value=value,
                    unit=unit,
                ))
            await db.commit()

        # WebSocket broadcast
        ws_data = {
            "type": "measurements",
            "timestamp": timestamp.isoformat(),
            "source": "data_acquisition",
            "data": {
                f"{source}.{metric}": value
                for source, metric, value, _ in measurements
            },
        }
        await broadcast(ws_data)


# Singleton-Instanz
data_acquisition = DataAcquisitionService()
