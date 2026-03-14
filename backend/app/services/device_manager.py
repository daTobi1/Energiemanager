"""
DeviceManager — Einheitliche Geraeteverwaltung mit Preset-System.

Ersetzt die geraetespezifischen Bridges (LambdaBridge, DataAcquisitionService)
durch eine generische, preset-getriebene Architektur.

Funktionen:
1. Preset-basiertes Lesen: Register-Gruppen, Auto-Modul-Erkennung, Transformationen
2. Preset-basiertes Schreiben: write_map + setpoint_routing
3. Generisches Lesen: Fuer Geraete ohne Preset (DataPoints wie bisher)
4. Geraete-Lifecycle: Registrieren, Verbinden, Polling, Status

Unterstuetzte Protokolle: Modbus TCP, MQTT, HTTP/REST (via Protocol-Handler)
"""

import asyncio
import logging
import struct
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.api.websocket import broadcast
from app.core.database import async_session
from app.drivers.presets import get_preset, get_preset_raw, list_presets
from app.models.config import (
    ConsumerConfig,
    GeneratorConfig,
    MeterConfig,
    StorageConfig,
)
from app.models.measurement import Measurement

logger = logging.getLogger(__name__)


# ── Datenstrukturen ───────────────────────────────────────────────────


@dataclass
class ManagedDevice:
    """Ein vom DeviceManager verwaltetes Geraet."""
    entity_id: str
    entity_type: str  # generator, meter, consumer, storage
    name: str
    preset_id: str | None = None
    protocol: str = ""
    host: str = ""
    port: int = 502
    unit_id: int = 1
    timeout: int = 30
    poll_interval: int = 30
    comm_config: dict = field(default_factory=dict)

    # Laufzeit-Status
    connected: bool = False
    modules_detected: dict = field(default_factory=dict)  # group_name → count
    last_values: dict = field(default_factory=dict)
    last_poll: str | None = None
    error_count: int = 0
    last_error: str | None = None

    # Modbus-Client (falls Modbus)
    _client: Any = field(default=None, repr=False)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)
    _poll_task: asyncio.Task | None = field(default=None, repr=False)


# ── Modbus-Hilfsfunktionen ───────────────────────────────────────────


def _decode_modbus_value(registers: list[int], data_type: str, scale: float) -> float:
    """Dekodiert Modbus-Register in einen skalierten Wert."""
    if data_type == "int32":
        raw = struct.pack(">HH", registers[0], registers[1])
        raw_value = struct.unpack(">i", raw)[0]
    elif data_type == "uint32":
        raw = struct.pack(">HH", registers[0], registers[1])
        raw_value = struct.unpack(">I", raw)[0]
    elif data_type == "uint16":
        raw_value = registers[0]
    elif data_type == "float32":
        raw = struct.pack(">HH", registers[0], registers[1])
        raw_value = struct.unpack(">f", raw)[0]
    else:  # int16
        raw = struct.pack(">H", registers[0])
        raw_value = struct.unpack(">h", raw)[0]
    return round(raw_value * scale, 4)


def _register_count(data_type: str) -> int:
    """Gibt die Anzahl Modbus-Register fuer einen Datentyp zurueck."""
    return 2 if data_type in ("int32", "uint32", "float32") else 1


# ── DeviceManager ────────────────────────────────────────────────────


class DeviceManager:
    """
    Einheitlicher Geraete-Manager mit Preset-Unterstuetzung.

    Verwaltet alle Hardware-Verbindungen, pollt zyklisch und
    routet Controller-Setpoints an die richtigen Geraete.
    """

    def __init__(self):
        self._devices: dict[str, ManagedDevice] = {}
        self._running = False
        self._scan_task: asyncio.Task | None = None

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def device_count(self) -> int:
        return len(self._devices)

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def start(self):
        """Startet den DeviceManager: scannt Entities und beginnt Polling."""
        if self._running:
            return
        self._running = True
        await self.scan_entities()
        logger.info("DeviceManager gestartet: %d Geraete", len(self._devices))

    async def stop(self):
        """Stoppt alle Geraete-Verbindungen und Polling-Tasks."""
        self._running = False
        for device in self._devices.values():
            await self._stop_device(device)
        self._devices.clear()
        logger.info("DeviceManager gestoppt")

    async def reload(self):
        """Konfiguration neu laden (z.B. nach Entity-Aenderung)."""
        if self._running:
            await self.stop()
            self._running = True
            await self.scan_entities()
            logger.info("DeviceManager neu geladen: %d Geraete", len(self._devices))

    # ── Geraete-Registrierung ─────────────────────────────────────────

    async def scan_entities(self):
        """
        Scannt alle Entities mit aktivierter Kommunikation und
        registriert sie als verwaltete Geraete.
        """
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

                    entity_id = entity.get("id", row.id)
                    preset_id = comm.get("driverPreset")

                    await self.register_device(
                        entity_id=entity_id,
                        entity_type=entity_type,
                        name=entity.get("name", entity_id),
                        comm_config=comm,
                        preset_id=preset_id,
                    )

    async def register_device(
        self,
        entity_id: str,
        entity_type: str,
        name: str,
        comm_config: dict,
        preset_id: str | None = None,
    ) -> dict:
        """Registriert ein Geraet und startet die Verbindung."""
        # Preset laden falls angegeben
        preset = get_preset(preset_id) if preset_id else None
        defaults = preset.defaults if preset else {}

        protocol = comm_config.get("protocol", "modbus_tcp")
        host = comm_config.get("ipAddress", "")
        port = comm_config.get("port", defaults.get("port", 502))
        unit_id = comm_config.get("modbus", {}).get("unitId", defaults.get("unitId", 1))
        timeout = defaults.get("timeout", 30)
        poll_interval = comm_config.get(
            "pollingIntervalSeconds",
            defaults.get("pollingIntervalSeconds", 30),
        )

        device = ManagedDevice(
            entity_id=entity_id,
            entity_type=entity_type,
            name=name,
            preset_id=preset_id,
            protocol=protocol,
            host=host,
            port=port,
            unit_id=unit_id,
            timeout=timeout,
            poll_interval=poll_interval,
            comm_config=comm_config,
        )

        # Bestehende Verbindung stoppen
        if entity_id in self._devices:
            await self._stop_device(self._devices[entity_id])

        self._devices[entity_id] = device

        if not host:
            logger.warning("DeviceManager: %s hat keine IP-Adresse", name)
            return {"registered": True, "connected": False, "reason": "no_ip"}

        # Verbindung herstellen
        success = await self._connect_device(device)

        if success and self._running:
            device._poll_task = asyncio.create_task(
                self._poll_loop(device),
                name=f"dm_poll_{entity_id}",
            )

        return {
            "registered": True,
            "connected": success,
            "preset": preset_id,
            "modules": device.modules_detected,
        }

    async def unregister_device(self, entity_id: str) -> bool:
        """Entfernt ein Geraet und stoppt seine Verbindung."""
        device = self._devices.pop(entity_id, None)
        if device:
            await self._stop_device(device)
            return True
        return False

    # ── Verbindung ────────────────────────────────────────────────────

    async def _connect_device(self, device: ManagedDevice) -> bool:
        """Stellt die Verbindung zu einem Geraet her."""
        if device.protocol in ("modbus_tcp", "sunspec"):
            return await self._connect_modbus(device)
        elif device.protocol == "mqtt":
            # MQTT ist push-basiert, kein aktiver Connect noetig
            device.connected = True
            return True
        elif device.protocol == "http_rest":
            # HTTP braucht keinen persistenten Connect
            device.connected = True
            return True
        else:
            logger.info("DeviceManager: Protokoll %s noch nicht implementiert", device.protocol)
            return False

    async def _connect_modbus(self, device: ManagedDevice) -> bool:
        """Modbus TCP Verbindung herstellen + Module erkennen."""
        try:
            from pymodbus.client import AsyncModbusTcpClient

            client = AsyncModbusTcpClient(
                device.host,
                port=device.port,
                timeout=device.timeout,
            )
            connected = await client.connect()
            if not connected:
                logger.warning("DeviceManager: Modbus %s:%d fehlgeschlagen", device.host, device.port)
                return False

            device._client = client
            device.connected = True
            logger.info("DeviceManager: Modbus verbunden %s:%d (%s)", device.host, device.port, device.name)

            # Auto-Detection bei Preset mit repeatable Gruppen
            if device.preset_id:
                await self._detect_modules(device)

            return True

        except ImportError:
            logger.error("DeviceManager: pymodbus nicht installiert")
            return False
        except Exception as e:
            logger.warning("DeviceManager: Modbus-Fehler %s: %s", device.name, e)
            return False

    async def _detect_modules(self, device: ManagedDevice):
        """Erkennt angeschlossene Module anhand der Preset-Registergruppen."""
        preset = get_preset(device.preset_id)
        if not preset:
            return

        for group_data in preset.register_groups:
            group_name = group_data.get("name", "")
            repeatable = group_data.get("repeatable", False)
            if not repeatable:
                device.modules_detected[group_name] = 1
                continue

            base = group_data.get("base_address", 0)
            max_inst = group_data.get("max_instances", 1)
            inst_offset = group_data.get("instance_offset", 100)
            probe_offset = group_data.get("probe_offset", 1)
            count = 0

            for i in range(max_inst):
                addr = base + i * inst_offset + probe_offset
                if await self._probe_register(device, addr):
                    count = i + 1

            device.modules_detected[group_name] = count

        logger.info(
            "DeviceManager: Module erkannt fuer %s: %s",
            device.name,
            {k: v for k, v in device.modules_detected.items() if v > 0},
        )

    async def _probe_register(self, device: ManagedDevice, address: int) -> bool:
        """Testet ob ein Modbus-Register lesbar ist."""
        try:
            async with device._lock:
                result = await device._client.read_holding_registers(
                    address, 1, slave=device.unit_id,
                )
            return not result.isError()
        except Exception:
            return False

    async def _stop_device(self, device: ManagedDevice):
        """Stoppt Polling und schliesst Verbindung."""
        if device._poll_task:
            device._poll_task.cancel()
            device._poll_task = None

        if device._client:
            try:
                device._client.close()
            except Exception:
                pass
            device._client = None

        device.connected = False

    # ── Preset-basiertes Lesen (Modbus) ──────────────────────────────

    async def _read_preset_modbus(self, device: ManagedDevice) -> dict[str, float]:
        """Liest alle Werte eines Preset-Geraets via Modbus."""
        preset = get_preset(device.preset_id)
        if not preset or not device._client:
            return {}

        values: dict[str, float] = {}

        for group_data in preset.register_groups:
            group_name = group_data.get("name", "")
            base = group_data.get("base_address", 0)
            repeatable = group_data.get("repeatable", False)
            source = group_data.get("source", group_name)
            source_tpl = group_data.get("source_template", "")
            registers = group_data.get("registers", [])
            inst_offset = group_data.get("instance_offset", 100)

            instances = device.modules_detected.get(group_name, 1 if not repeatable else 0)

            for inst_idx in range(instances):
                # Source-Name bestimmen
                if repeatable and source_tpl:
                    src = source_tpl.replace("{instance}", str(inst_idx + 1))
                elif repeatable:
                    src = f"{source}_{inst_idx + 1}"
                else:
                    src = source

                inst_base = base + inst_idx * inst_offset

                for reg in registers:
                    offset = reg.get("offset", 0)
                    metric = reg.get("metric", "")
                    scale = reg.get("scale", 1.0)
                    data_type = reg.get("data_type", "int16")
                    address = inst_base + offset
                    count = _register_count(data_type)

                    try:
                        async with device._lock:
                            result = await device._client.read_holding_registers(
                                address, count, slave=device.unit_id,
                            )
                        if result.isError():
                            continue

                        value = _decode_modbus_value(result.registers, data_type, scale)
                        values[f"{src}.{metric}"] = value
                    except Exception as e:
                        logger.debug("DeviceManager: Register %d Fehler: %s", address, e)

        # Berechnete Werte anwenden
        for cv in preset.computed_values:
            src_metric = cv.get("source_metric", "")
            target_metric = cv.get("metric", "")
            transform = cv.get("transform", "value")

            # Suche den Quellwert in allen Sources
            for key, val in list(values.items()):
                if key.endswith(f".{src_metric}"):
                    source_prefix = key.rsplit(".", 1)[0]
                    try:
                        result_val = eval(transform, {"value": val, "__builtins__": {}})
                        values[f"{source_prefix}.{target_metric}"] = round(result_val, 4)
                    except Exception:
                        pass

        # State-Maps anwenden
        for state_key, state_map in preset.state_maps.items():
            for key, val in list(values.items()):
                if key.endswith(f".{state_key}"):
                    source_prefix = key.rsplit(".", 1)[0]
                    text = state_map.get(str(int(val)), f"Unbekannt ({int(val)})")
                    values[f"{source_prefix}.{state_key}_text"] = text

        device.last_values = values
        return values

    # ── Generisches Lesen (HTTP/Modbus ohne Preset) ──────────────────

    async def _read_generic(self, device: ManagedDevice) -> dict[str, float]:
        """Liest Werte eines Geraets ohne Preset ueber Standard-Datenpunkte."""
        # Fuer generische Geraete wird das bestehende DAQ-System genutzt
        # Hier minimal: nur Modbus und HTTP unterstuetzt
        comm = device.comm_config
        values: dict[str, float] = {}

        if device.protocol in ("modbus_tcp", "sunspec") and device._client:
            modbus_cfg = comm.get("modbus", {})
            base_addr = modbus_cfg.get("registerAddress", 0)
            data_type = modbus_cfg.get("dataType", "float32")
            scale = modbus_cfg.get("scaleFactor", 1.0)
            count = _register_count(data_type)

            try:
                async with device._lock:
                    result = await device._client.read_holding_registers(
                        base_addr, count, slave=device.unit_id,
                    )
                if not result.isError():
                    value = _decode_modbus_value(result.registers, data_type, scale)
                    values["value"] = value
            except Exception as e:
                logger.debug("DeviceManager: Generic-Read Fehler %s: %s", device.name, e)

        elif device.protocol == "http_rest":
            import httpx

            http_cfg = comm.get("http", {})
            base_url = http_cfg.get("baseUrl", "")
            endpoint = http_cfg.get("endpoint", "")
            if base_url:
                url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}" if endpoint else base_url
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.get(url)
                        resp.raise_for_status()
                        data = resp.json()
                        if isinstance(data, dict):
                            for k, v in data.items():
                                try:
                                    values[k] = float(v)
                                except (ValueError, TypeError):
                                    pass
                except Exception as e:
                    logger.debug("DeviceManager: HTTP-Read Fehler %s: %s", device.name, e)

        device.last_values = values
        return values

    # ── Polling ───────────────────────────────────────────────────────

    async def _poll_loop(self, device: ManagedDevice):
        """Periodisches Lesen fuer ein Geraet."""
        try:
            while self._running and device.connected:
                try:
                    await self._poll_device(device)
                except Exception as e:
                    device.error_count += 1
                    device.last_error = str(e)
                    logger.warning("DeviceManager: Poll-Fehler %s: %s", device.name, e)

                await asyncio.sleep(device.poll_interval)
        except asyncio.CancelledError:
            pass

    async def _poll_device(self, device: ManagedDevice):
        """Liest Werte und schreibt Messwerte in die DB."""
        if device.preset_id:
            values = await self._read_preset_modbus(device)
        else:
            values = await self._read_generic(device)

        if not values:
            return

        device.last_poll = datetime.now(timezone.utc).isoformat()

        # Messwerte in DB schreiben + WebSocket broadcast
        measurements = self._values_to_measurements(device, values)
        if measurements:
            await self._store_measurements(measurements)

    def _values_to_measurements(
        self, device: ManagedDevice, values: dict
    ) -> list[tuple[str, str, float, str]]:
        """Konvertiert Device-Werte in (source, metric, value, unit) Tupel."""
        measurements = []
        preset = get_preset(device.preset_id) if device.preset_id else None

        if preset:
            # Preset-basiert: source.metric ist bereits im Key
            # Wir muessen unit aus dem Preset-Register nachschlagen
            unit_map = {}
            for group in preset.register_groups:
                for reg in group.get("registers", []):
                    unit_map[reg.get("metric", "")] = reg.get("unit", "")

            for key, value in values.items():
                if isinstance(value, str):
                    continue  # State-Texte ueberspringen
                parts = key.rsplit(".", 1)
                if len(parts) == 2:
                    source, metric = parts
                    unit = unit_map.get(metric, "")
                    measurements.append((source, metric, value, unit))
        else:
            # Generisch: entity_id als Source
            source = device.entity_id
            for metric, value in values.items():
                measurements.append((source, metric, value, ""))

        return measurements

    async def _store_measurements(
        self,
        measurements: list[tuple[str, str, float, str]],
    ):
        """Schreibt Messwerte in die DB und broadcastet via WebSocket."""
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

        ws_data = {
            "type": "measurements",
            "timestamp": now.isoformat(),
            "source": "device_manager",
            "data": {
                f"{source}.{metric}": value
                for source, metric, value, _ in measurements
            },
        }
        await broadcast(ws_data)

    # ── Schreiben ─────────────────────────────────────────────────────

    async def write_setpoint(self, entity_id: str, key: str, value: float) -> bool:
        """Schreibt einen Stellwert an ein Geraet ueber dessen Preset write_map."""
        device = self._devices.get(entity_id)
        if not device or not device.connected:
            return False

        preset_raw = get_preset_raw(device.preset_id) if device.preset_id else None
        if not preset_raw:
            logger.warning("DeviceManager: Kein Preset fuer %s", entity_id)
            return False

        write_map = preset_raw.get("write_map", {})
        if key not in write_map:
            logger.warning("DeviceManager: Key '%s' nicht in write_map von %s", key, device.preset_id)
            return False

        entry = write_map[key]
        address = entry["address"]
        scale = entry.get("scale", 1.0)
        data_type = entry.get("data_type", "int16")

        register_value = int(round(float(value) * scale))

        if device.protocol in ("modbus_tcp", "sunspec") and device._client:
            try:
                async with device._lock:
                    if data_type in ("int32", "uint32"):
                        # 32-bit: zwei Register schreiben
                        raw = struct.pack(">i", register_value)
                        regs = [
                            struct.unpack(">H", raw[0:2])[0],
                            struct.unpack(">H", raw[2:4])[0],
                        ]
                        result = await device._client.write_registers(
                            address, regs, slave=device.unit_id,
                        )
                    else:
                        # 16-bit: ein Register
                        result = await device._client.write_register(
                            address, register_value, slave=device.unit_id,
                        )

                if result.isError():
                    logger.warning("DeviceManager: Schreibfehler %s@%d: %s", key, address, result)
                    return False

                logger.debug("DeviceManager: %s.%s = %s (reg %d = %d)", device.name, key, value, address, register_value)
                return True

            except Exception as e:
                logger.warning("DeviceManager: Schreibfehler %s.%s: %s", device.name, key, e)
                return False

        return False

    async def apply_controller_setpoints(self, setpoints) -> dict:
        """
        Routet Controller-Setpoints an alle relevanten Geraete.

        Nutzt das setpoint_routing im Preset, um abstrakte Setpoints
        (z.B. hp_thermal_kw, flow_temp_c) auf geraetespezifische
        write_map-Keys abzubilden.
        """
        results = {}

        for device in self._devices.values():
            if not device.connected or not device.preset_id:
                continue

            preset_raw = get_preset_raw(device.preset_id)
            if not preset_raw:
                continue

            routing = preset_raw.get("setpoint_routing", {})
            write_map = preset_raw.get("write_map", {})

            # Setpoint-Routing anwenden
            for sp_key, route in routing.items():
                sp_value = getattr(setpoints, sp_key, None)
                if sp_value is None or sp_value == 0:
                    continue

                target_key = route.get("target", "")
                transform = route.get("transform", "value")

                if target_key not in write_map:
                    continue

                try:
                    final_value = eval(transform, {"value": sp_value, "__builtins__": {}})
                except Exception:
                    final_value = sp_value

                ok = await self.write_setpoint(device.entity_id, target_key, final_value)
                results[f"{device.entity_id}.{target_key}"] = {
                    "success": ok,
                    "value": final_value,
                    "from": sp_key,
                }

            # Pro-Kreis Vorlauftemperaturen (circuit_setpoints)
            circuit_sps = getattr(setpoints, "circuit_setpoints", [])
            for i, cs in enumerate(circuit_sps):
                key = f"hc_{i+1}_flow_temp_c"
                if key in write_map:
                    ok = await self.write_setpoint(device.entity_id, key, cs.flow_temp_c)
                    results[f"{device.entity_id}.{key}"] = {
                        "success": ok,
                        "value": cs.flow_temp_c,
                        "circuit": cs.circuit_id,
                    }

        return results

    # ── Status & Info ─────────────────────────────────────────────────

    def get_device_status(self, entity_id: str) -> dict | None:
        """Gibt den Status eines einzelnen Geraets zurueck."""
        device = self._devices.get(entity_id)
        if not device:
            return None

        return {
            "entity_id": device.entity_id,
            "entity_type": device.entity_type,
            "name": device.name,
            "preset_id": device.preset_id,
            "protocol": device.protocol,
            "host": device.host,
            "port": device.port,
            "connected": device.connected,
            "modules": device.modules_detected,
            "last_poll": device.last_poll,
            "error_count": device.error_count,
            "last_error": device.last_error,
            "value_count": len(device.last_values),
        }

    def get_device_values(self, entity_id: str) -> dict | None:
        """Gibt die aktuellen Werte eines Geraets zurueck."""
        device = self._devices.get(entity_id)
        if not device:
            return None
        return dict(device.last_values)

    @property
    def status(self) -> dict:
        """Gesamtstatus des DeviceManagers."""
        devices_summary = []
        for d in self._devices.values():
            devices_summary.append({
                "entity_id": d.entity_id,
                "name": d.name,
                "preset_id": d.preset_id,
                "protocol": d.protocol,
                "connected": d.connected,
                "modules": d.modules_detected,
                "values": len(d.last_values),
                "errors": d.error_count,
            })
        return {
            "running": self._running,
            "device_count": len(self._devices),
            "connected_count": sum(1 for d in self._devices.values() if d.connected),
            "devices": devices_summary,
        }

    def get_preset_devices(self) -> list[dict]:
        """Gibt alle Geraete mit Preset zurueck."""
        return [
            self.get_device_status(d.entity_id)
            for d in self._devices.values()
            if d.preset_id
        ]


# Singleton
device_manager = DeviceManager()
