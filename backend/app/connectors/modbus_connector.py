"""Modbus TCP Connector für Wechselrichter, Zähler, etc."""

import logging
from typing import Any

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)


class ModbusConnector(BaseConnector):
    """Verbindung zu Geräten via Modbus TCP."""

    def __init__(self, host: str, port: int = 502, unit_id: int = 1):
        self.host = host
        self.port = port
        self.unit_id = unit_id
        self._client = None

    async def connect(self) -> bool:
        try:
            from pymodbus.client import AsyncModbusTcpClient

            self._client = AsyncModbusTcpClient(self.host, port=self.port)
            connected = await self._client.connect()
            logger.info("Modbus connected to %s:%d = %s", self.host, self.port, connected)
            return connected
        except Exception:
            logger.exception("Modbus connection failed")
            return False

    async def disconnect(self) -> None:
        if self._client:
            self._client.close()
            self._client = None

    async def read_values(self) -> dict[str, Any]:
        if not self._client:
            return {}

        # Beispiel: SMA Wechselrichter Register lesen
        # Register-Adressen sind gerätespezifisch
        result = await self._client.read_holding_registers(
            address=30775, count=2, slave=self.unit_id
        )
        if result.isError():
            logger.error("Modbus read error: %s", result)
            return {}

        return {"power_w": result.registers[0]}

    async def write_setpoint(self, key: str, value: Any) -> bool:
        if not self._client:
            return False

        # Beispiel: Leistungsbegrenzung setzen
        result = await self._client.write_register(
            address=40236, value=int(value), slave=self.unit_id
        )
        return not result.isError()

    async def is_connected(self) -> bool:
        return self._client is not None and self._client.connected
