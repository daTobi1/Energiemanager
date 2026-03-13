"""
Lambda Wärmepumpe — Modbus TCP Treiber.

Unterstützt alle Lambda Eureka EU-L Modelle (EU08L–EU20L) und
Zewotherm-OEM-Varianten. Basiert auf der offiziellen Lambda
Modbus-Dokumentation.

Protokoll:  Modbus TCP, Port 502, Holding Registers
Slave-ID:   1 (Standard)
Timeout:    60s (Lambda-spezifisch, höher als üblich)
Max. Module: 3 WP, 5 Boiler, 5 Buffer, 2 Solar, 12 Heizkreise
"""

import asyncio
import logging
import struct
from dataclasses import dataclass, field
from typing import Any

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)

# ── Konstanten ────────────────────────────────────────────────────────

DEFAULT_PORT = 502
DEFAULT_SLAVE_ID = 1
DEFAULT_TIMEOUT = 60  # Lambda braucht längere Timeouts
POLL_INTERVAL = 30    # Standard-Pollintervall (s)
WRITE_INTERVAL = 9    # PV-Überschuss-Schreibintervall (s)

# Betriebszustände
OPERATING_STATES = {
    0: "STBY",      # Standby
    1: "CH",        # Heizen (Central Heating)
    2: "DHW",       # Warmwasser (Domestic Hot Water)
    3: "CC",        # Kühlen (Central Cooling)
    4: "CIRCULATE", # Zirkulation
    5: "DEFROST",   # Abtauen
    6: "OFF",       # Aus
    7: "FROST",     # Frostschutz
    10: "SUMMER",   # Sommerbetrieb
    11: "HOLIDAY",  # Urlaub
    12: "ERROR",    # Fehler
}

HP_STATES = {
    0: "Aus",
    1: "Heizen",
    2: "Warmwasser",
    3: "Kühlen",
    4: "Zirkulation",
    5: "Abtauen",
}


# ── Register-Map ─────────────────────────────────────────────────────

@dataclass
class Register:
    """Definition eines Modbus-Registers."""
    address: int
    name: str
    metric: str          # Measurement-Metrik-Name
    unit: str
    scale: float = 1.0   # Skalierungsfaktor (z.B. 0.1 = Register/10)
    data_type: str = "int16"  # int16, uint16, int32
    writable: bool = False


# Globale Register (Ambient + E-Manager)
AMBIENT_REGISTERS = [
    Register(0, "Ambient Error Number", "ambient_error", "", 1, "int16"),
    Register(1, "Ambient Operating State", "ambient_state", "", 1, "uint16"),
    Register(2, "Ambient Temperature", "outdoor_temperature_c", "°C", 0.1, "int16"),
    Register(3, "Ambient Temp 1h Mean", "outdoor_temp_1h_c", "°C", 0.1, "int16"),
    Register(4, "Ambient Temp Calculated", "outdoor_temp_calc_c", "°C", 0.1, "int16"),
]

EMANAGER_REGISTERS = [
    Register(100, "E-Manager Error Number", "emanager_error", "", 1, "int16"),
    Register(101, "E-Manager Operating State", "emanager_state", "", 1, "uint16"),
    Register(102, "E-Manager Actual Power", "pv_surplus_w", "W", 1, "int16", writable=True),
    Register(103, "E-Manager Power Consumption", "total_power_w", "W", 1, "int16"),
    Register(104, "E-Manager Consumption Setpoint", "power_setpoint_w", "W", 1, "int16"),
]


def _hp_registers(base: int) -> list[Register]:
    """Register-Map für eine Wärmepumpe (Basis 1000/1100/1200)."""
    return [
        Register(base + 0, "HP Error State", "hp_error_state", "", 1, "uint16"),
        Register(base + 1, "HP Error Number", "hp_error_number", "", 1, "int16"),
        Register(base + 2, "HP Compressor State", "hp_compressor_state", "", 1, "uint16"),
        Register(base + 3, "HP Operating State", "hp_operating_state", "", 1, "uint16"),
        Register(base + 4, "HP Flow Temperature", "flow_temperature_c", "°C", 0.01, "int16"),
        Register(base + 5, "HP Return Temperature", "return_temperature_c", "°C", 0.01, "int16"),
        Register(base + 6, "HP Volume Flow Heat Sink", "volume_flow_lh", "l/h", 1, "int16"),
        Register(base + 7, "HP Source Inlet Temp", "source_inlet_temp_c", "°C", 0.01, "int16"),
        Register(base + 8, "HP Source Outlet Temp", "source_outlet_temp_c", "°C", 0.01, "int16"),
        Register(base + 9, "HP Volume Flow Source", "source_volume_flow_lmin", "l/min", 0.01, "int16"),
        Register(base + 10, "HP Compressor Rating", "compressor_rating_pct", "%", 0.01, "uint16"),
        Register(base + 11, "HP Heating Capacity", "heat_kw", "kW", 0.1, "int16"),
        Register(base + 12, "HP Inverter Power", "power_w", "W", 1, "int16"),
        Register(base + 13, "HP COP", "cop", "", 0.01, "int16"),
        Register(base + 15, "HP Request Type", "request_type", "", 1, "int16", writable=True),
        Register(base + 16, "HP Requested Flow Temp", "requested_flow_temp_c", "°C", 0.1, "int16", writable=True),
        Register(base + 17, "HP Requested Return Temp", "requested_return_temp_c", "°C", 0.1, "int16", writable=True),
        Register(base + 19, "HP 2nd Heating Stage", "second_stage_state", "", 1, "int16"),
        # Akkumulierte Energie (int32, 2 Register)
        Register(base + 20, "HP Elec Energy Accum", "energy_consumed_wh", "Wh", 1, "int32"),
        Register(base + 22, "HP Thermal Energy Accum", "energy_produced_wh", "Wh", 1, "int32"),
        Register(base + 25, "HP VdA Rating", "vda_rating_pct", "%", 0.01, "uint16"),
        Register(base + 26, "HP Hot Gas Temp", "hot_gas_temp_c", "°C", 0.01, "int16"),
        Register(base + 29, "HP Condensation Temp", "condensation_temp_c", "°C", 0.01, "int16"),
        Register(base + 30, "HP Evaporation Temp", "evaporation_temp_c", "°C", 0.01, "int16"),
        Register(base + 31, "HP EqM Rating", "eqm_rating_pct", "%", 0.01, "uint16"),
    ]


def _boiler_registers(base: int) -> list[Register]:
    """Register-Map für einen Warmwasserspeicher (Basis 2000/2100/...)."""
    return [
        Register(base + 0, "Boiler Error Number", "boiler_error", "", 1, "int16"),
        Register(base + 1, "Boiler Operating State", "boiler_state", "", 1, "uint16"),
        Register(base + 2, "Boiler Temp High", "boiler_temp_high_c", "°C", 0.1, "int16"),
        Register(base + 3, "Boiler Temp Low", "boiler_temp_low_c", "°C", 0.1, "int16"),
        Register(base + 4, "Boiler Circ Temp", "boiler_circ_temp_c", "°C", 0.1, "int16"),
        Register(base + 5, "Boiler Circ Pump State", "boiler_circ_pump", "", 1, "int16"),
        Register(base + 50, "Boiler Target Temp", "boiler_target_temp_c", "°C", 0.1, "int16", writable=True),
    ]


def _buffer_registers(base: int) -> list[Register]:
    """Register-Map für einen Pufferspeicher (Basis 3000/3100/...)."""
    return [
        Register(base + 0, "Buffer Error Number", "buffer_error", "", 1, "int16"),
        Register(base + 1, "Buffer Operating State", "buffer_state", "", 1, "uint16"),
        Register(base + 2, "Buffer Temp High", "buffer_temp_high_c", "°C", 0.1, "int16"),
        Register(base + 3, "Buffer Temp Low", "buffer_temp_low_c", "°C", 0.1, "int16"),
        Register(base + 4, "Buffer Temp High Setpoint", "buffer_temp_setpoint_c", "°C", 0.1, "int16", writable=True),
        Register(base + 6, "Buffer Flow Temp Setpoint", "buffer_flow_setpoint_c", "°C", 0.1, "int16"),
        Register(base + 9, "Buffer Requested Capacity", "buffer_requested_kw", "kW", 0.1, "int16"),
        Register(base + 50, "Buffer Max Temp", "buffer_max_temp_c", "°C", 0.1, "int16", writable=True),
    ]


def _solar_registers(base: int) -> list[Register]:
    """Register-Map für Solarthermie (Basis 4000/4100)."""
    return [
        Register(base + 0, "Solar Error Number", "solar_error", "", 1, "int16"),
        Register(base + 1, "Solar Operating State", "solar_state", "", 1, "uint16"),
        Register(base + 2, "Solar Collector Temp", "solar_collector_temp_c", "°C", 0.1, "int16"),
        Register(base + 3, "Solar Storage Temp", "solar_storage_temp_c", "°C", 0.1, "int16"),
        Register(base + 4, "Solar Power", "solar_power_kw", "kW", 0.1, "int16"),
        Register(base + 5, "Solar Energy Total", "solar_energy_kwh", "kWh", 1, "int32"),
    ]


def _heating_circuit_registers(base: int) -> list[Register]:
    """Register-Map für einen Heizkreis (Basis 5000/5100/...)."""
    return [
        Register(base + 0, "HC Error Number", "hc_error", "", 1, "int16"),
        Register(base + 1, "HC Operating State", "hc_state", "", 1, "uint16"),
        Register(base + 2, "HC Flow Temp", "hc_flow_temp_c", "°C", 0.1, "int16"),
        Register(base + 3, "HC Return Temp", "hc_return_temp_c", "°C", 0.1, "int16"),
        Register(base + 4, "HC Room Temp", "hc_room_temp_c", "°C", 0.1, "int16", writable=True),
        Register(base + 5, "HC Set Flow Temp", "hc_set_flow_temp_c", "°C", 0.1, "int16", writable=True),
        Register(base + 6, "HC Operating Mode", "hc_mode", "", 1, "int16", writable=True),
        Register(base + 7, "HC Flow Temp Setpoint", "hc_flow_setpoint_c", "°C", 0.1, "int16"),
        Register(base + 50, "HC Flow Offset", "hc_flow_offset_c", "°C", 0.1, "int16", writable=True),
        Register(base + 51, "HC Target Room Temp", "hc_target_room_temp_c", "°C", 0.1, "int16", writable=True),
    ]


# ── Auto-Detection ──────────────────────────────────────────────────

@dataclass
class LambdaModules:
    """Erkannte Module einer Lambda-Anlage."""
    heat_pumps: int = 0      # 0-3
    boilers: int = 0         # 0-5
    buffers: int = 0         # 0-5
    solar_modules: int = 0   # 0-2
    heating_circuits: int = 0  # 0-12


# ── Lambda HP Connector ─────────────────────────────────────────────


class LambdaHPConnector(BaseConnector):
    """
    Vollständiger Modbus-Treiber für Lambda Wärmepumpen.

    Liest alle verfügbaren Module (WP, Boiler, Buffer, Solar, Heizkreise)
    und stellt Schreibzugriff für Stellgrößen bereit.
    """

    def __init__(
        self,
        host: str,
        port: int = DEFAULT_PORT,
        slave_id: int = DEFAULT_SLAVE_ID,
        timeout: int = DEFAULT_TIMEOUT,
    ):
        self.host = host
        self.port = port
        self.slave_id = slave_id
        self.timeout = timeout
        self._client: Any = None
        self._lock = asyncio.Lock()
        self._modules = LambdaModules()
        self._last_values: dict[str, Any] = {}

    async def connect(self) -> bool:
        """Verbindung herstellen und Module auto-detektieren."""
        try:
            from pymodbus.client import AsyncModbusTcpClient

            self._client = AsyncModbusTcpClient(
                self.host,
                port=self.port,
                timeout=self.timeout,
            )
            connected = await self._client.connect()
            if not connected:
                logger.warning("Lambda HP: Verbindung zu %s:%d fehlgeschlagen", self.host, self.port)
                return False

            logger.info("Lambda HP: Verbunden mit %s:%d", self.host, self.port)

            # Module erkennen
            await self._detect_modules()
            return True

        except ImportError:
            logger.error("Lambda HP: pymodbus nicht installiert (pip install pymodbus)")
            return False
        except Exception:
            logger.exception("Lambda HP: Verbindungsfehler")
            return False

    async def disconnect(self) -> None:
        if self._client:
            self._client.close()
            self._client = None
            logger.info("Lambda HP: Verbindung getrennt")

    async def is_connected(self) -> bool:
        return self._client is not None and self._client.connected

    async def _detect_modules(self):
        """Erkennt angeschlossene Module durch Probe-Reads."""
        # Wärmepumpen (Basis 1000, 1100, 1200)
        for i, base in enumerate([1000, 1100, 1200]):
            if await self._probe_register(base + 3):
                self._modules.heat_pumps = i + 1

        # Boiler (Basis 2000–2400)
        for i, base in enumerate([2000, 2100, 2200, 2300, 2400]):
            if await self._probe_register(base + 1):
                self._modules.boilers = i + 1

        # Buffer (Basis 3000–3400)
        for i, base in enumerate([3000, 3100, 3200, 3300, 3400]):
            if await self._probe_register(base + 1):
                self._modules.buffers = i + 1

        # Solar (Basis 4000–4100)
        for i, base in enumerate([4000, 4100]):
            if await self._probe_register(base + 1):
                self._modules.solar_modules = i + 1

        # Heizkreise (Basis 5000–5B00)
        for i in range(12):
            base = 5000 + i * 100
            if await self._probe_register(base + 1):
                self._modules.heating_circuits = i + 1

        logger.info(
            "Lambda HP Module: %d WP, %d Boiler, %d Buffer, %d Solar, %d HK",
            self._modules.heat_pumps,
            self._modules.boilers,
            self._modules.buffers,
            self._modules.solar_modules,
            self._modules.heating_circuits,
        )

    async def _probe_register(self, address: int) -> bool:
        """Testet ob ein Register lesbar ist (→ Modul vorhanden)."""
        try:
            async with self._lock:
                result = await self._client.read_holding_registers(
                    address, 1, slave=self.slave_id
                )
            return not result.isError()
        except Exception:
            return False

    # ── Lesen ────────────────────────────────────────────────────────

    async def read_values(self) -> dict[str, Any]:
        """Liest alle Werte der erkannten Module."""
        if not self._client or not self._client.connected:
            return {}

        values: dict[str, Any] = {}

        # Ambient + E-Manager (immer vorhanden)
        await self._read_register_group(AMBIENT_REGISTERS, "ambient", values)
        await self._read_register_group(EMANAGER_REGISTERS, "emanager", values)

        # Wärmepumpen
        for i in range(self._modules.heat_pumps):
            base = 1000 + i * 100
            prefix = f"hp_{i + 1}" if self._modules.heat_pumps > 1 else "hp"
            regs = _hp_registers(base)
            await self._read_register_group(regs, prefix, values)

            # Berechnete Werte
            power_w = values.get(f"{prefix}.power_w", 0)
            heat_kw = values.get(f"{prefix}.heat_kw", 0)
            if power_w > 0:
                values[f"{prefix}.power_kw"] = round(power_w / 1000, 3)
            if heat_kw > 0 and power_w > 0:
                values[f"{prefix}.cop_calculated"] = round(heat_kw / (power_w / 1000), 2)
            # Betriebszustand als Text
            state_code = values.get(f"{prefix}.hp_operating_state", 0)
            values[f"{prefix}.operating_state_text"] = OPERATING_STATES.get(int(state_code), f"Unbekannt ({state_code})")

        # Boiler
        for i in range(self._modules.boilers):
            base = 2000 + i * 100
            prefix = f"boiler_{i + 1}" if self._modules.boilers > 1 else "boiler"
            await self._read_register_group(_boiler_registers(base), prefix, values)

        # Buffer
        for i in range(self._modules.buffers):
            base = 3000 + i * 100
            prefix = f"buffer_{i + 1}" if self._modules.buffers > 1 else "buffer"
            await self._read_register_group(_buffer_registers(base), prefix, values)

        # Solar
        for i in range(self._modules.solar_modules):
            base = 4000 + i * 100
            prefix = f"solar_{i + 1}" if self._modules.solar_modules > 1 else "solar"
            await self._read_register_group(_solar_registers(base), prefix, values)

        # Heizkreise
        for i in range(self._modules.heating_circuits):
            base = 5000 + i * 100
            prefix = f"hc_{i + 1}"
            await self._read_register_group(_heating_circuit_registers(base), prefix, values)

        self._last_values = values
        return values

    async def _read_register_group(
        self,
        registers: list[Register],
        prefix: str,
        values: dict[str, Any],
    ):
        """Liest eine Gruppe von Registern mit Batch-Optimierung."""
        for reg in registers:
            try:
                count = 2 if reg.data_type == "int32" else 1
                async with self._lock:
                    result = await self._client.read_holding_registers(
                        reg.address, count, slave=self.slave_id
                    )
                if result.isError():
                    continue

                if reg.data_type == "int32":
                    # 2 Register zu int32 zusammenbauen
                    raw = struct.pack(">HH", result.registers[0], result.registers[1])
                    raw_value = struct.unpack(">i", raw)[0]
                elif reg.data_type == "uint16":
                    raw_value = result.registers[0]
                else:  # int16
                    raw = struct.pack(">H", result.registers[0])
                    raw_value = struct.unpack(">h", raw)[0]

                value = round(raw_value * reg.scale, 4)
                values[f"{prefix}.{reg.metric}"] = value

            except Exception as e:
                logger.debug("Lambda HP: Register %d (%s) Lesefehler: %s", reg.address, reg.name, e)

    # ── Schreiben ────────────────────────────────────────────────────

    async def write_setpoint(self, key: str, value: Any) -> bool:
        """
        Schreibt einen Stellwert an die Lambda WP.

        Unterstützte Keys:
        - pv_surplus_w:         PV-Überschuss in Watt (Register 102)
        - boiler_target_temp_c: WW-Solltemperatur in °C (Register 2050)
        - hc_target_room_temp_c: Raum-Soll in °C (Register 5051, +100 pro HK)
        - hc_flow_offset_c:    Heizkurven-Offset in °C (Register 5050, +100 pro HK)
        - hp_requested_flow_temp_c: Angeforderte Vorlauf-Temp (Register 1016)
        """
        if not self._client or not self._client.connected:
            return False

        # Mapping: key → (register_address, scale_factor)
        write_map: dict[str, tuple[int, float]] = {
            "pv_surplus_w": (102, 1.0),
            "boiler_target_temp_c": (2050, 10.0),       # °C × 10
            "hc_1_target_room_temp_c": (5051, 10.0),
            "hc_2_target_room_temp_c": (5151, 10.0),
            "hc_3_target_room_temp_c": (5251, 10.0),
            "hc_1_flow_offset_c": (5050, 10.0),
            "hc_2_flow_offset_c": (5150, 10.0),
            "hc_3_flow_offset_c": (5250, 10.0),
            "hp_requested_flow_temp_c": (1016, 10.0),
            "hp_requested_return_temp_c": (1017, 10.0),
        }

        if key not in write_map:
            logger.warning("Lambda HP: Unbekannter Schreib-Key: %s", key)
            return False

        address, scale = write_map[key]
        register_value = int(round(float(value) * scale))

        try:
            async with self._lock:
                result = await self._client.write_register(
                    address, register_value, slave=self.slave_id
                )
            if result.isError():
                logger.warning("Lambda HP: Schreibfehler Register %d: %s", address, result)
                return False

            logger.debug("Lambda HP: Register %d = %d (key=%s, value=%s)", address, register_value, key, value)
            return True

        except Exception as e:
            logger.warning("Lambda HP: Schreibfehler %s: %s", key, e)
            return False

    async def write_pv_surplus(self, watts: int) -> bool:
        """Schreibt aktuellen PV-Überschuss an den E-Manager (Register 102)."""
        return await self.write_setpoint("pv_surplus_w", watts)

    # ── DAQ-Integration ──────────────────────────────────────────────

    def get_measurements(self) -> list[tuple[str, str, float, str]]:
        """
        Wandelt gelesene Werte in das DAQ-Measurement-Format um.

        Returns: [(source, metric, value, unit), ...]
        """
        if not self._last_values:
            return []

        measurements = []

        # Kernwerte der Wärmepumpe → "heat_pump" Source
        hp_mappings = {
            "hp.power_kw": ("heat_pump", "power_kw", "kW"),
            "hp.heat_kw": ("heat_pump", "heat_kw", "kW"),
            "hp.cop": ("heat_pump", "cop", ""),
            "hp.flow_temperature_c": ("heat_pump", "flow_temperature_c", "°C"),
            "hp.return_temperature_c": ("heat_pump", "return_temperature_c", "°C"),
            "hp.compressor_rating_pct": ("heat_pump", "modulation_pct", "%"),
            "hp.hp_operating_state": ("heat_pump", "operating_state", ""),
            "hp.energy_consumed_wh": ("heat_pump", "energy_consumed_wh", "Wh"),
            "hp.energy_produced_wh": ("heat_pump", "energy_produced_wh", "Wh"),
        }

        for raw_key, (source, metric, unit) in hp_mappings.items():
            if raw_key in self._last_values:
                measurements.append((source, metric, self._last_values[raw_key], unit))

        # Außentemperatur
        if "ambient.outdoor_temperature_c" in self._last_values:
            measurements.append(("outdoor", "temperature_c", self._last_values["ambient.outdoor_temperature_c"], "°C"))

        # Boiler → "heat_storage" Source
        if "boiler.boiler_temp_high_c" in self._last_values:
            measurements.append(("heat_storage", "temperature_c", self._last_values["boiler.boiler_temp_high_c"], "°C"))

        # Buffer → "buffer" Source
        if "buffer.buffer_temp_high_c" in self._last_values:
            measurements.append(("buffer", "temperature_high_c", self._last_values["buffer.buffer_temp_high_c"], "°C"))
        if "buffer.buffer_temp_low_c" in self._last_values:
            measurements.append(("buffer", "temperature_low_c", self._last_values["buffer.buffer_temp_low_c"], "°C"))

        # Heizkreise
        for i in range(self._modules.heating_circuits):
            prefix = f"hc_{i + 1}"
            source = f"heating_circuit_{i + 1}"
            for metric_suffix, unit in [("flow_temp_c", "°C"), ("return_temp_c", "°C"), ("room_temp_c", "°C")]:
                raw_key = f"{prefix}.hc_{metric_suffix}"
                if raw_key in self._last_values:
                    measurements.append((source, metric_suffix, self._last_values[raw_key], unit))

        return measurements

    # ── Komfort-Methoden ─────────────────────────────────────────────

    @property
    def modules(self) -> LambdaModules:
        return self._modules

    @property
    def last_values(self) -> dict[str, Any]:
        return dict(self._last_values)

    def get_operating_state(self) -> str:
        """Gibt aktuellen Betriebszustand als Text zurück."""
        return self._last_values.get("hp.operating_state_text", "Unbekannt")

    def get_error(self) -> int | None:
        """Gibt aktive Fehlernummer zurück (0 = kein Fehler)."""
        err = self._last_values.get("hp.hp_error_number", 0)
        return int(err) if err else None

    @property
    def info(self) -> dict:
        """Status-Übersicht der Lambda-Anlage."""
        return {
            "host": self.host,
            "port": self.port,
            "connected": self._client is not None and self._client.connected,
            "modules": {
                "heat_pumps": self._modules.heat_pumps,
                "boilers": self._modules.boilers,
                "buffers": self._modules.buffers,
                "solar_modules": self._modules.solar_modules,
                "heating_circuits": self._modules.heating_circuits,
            },
            "operating_state": self.get_operating_state(),
            "error": self.get_error(),
        }
