"""Wallbox Connector — Anbindung an Wallbox-APIs."""

import logging
from typing import Any

import httpx

from app.connectors.base import BaseConnector

logger = logging.getLogger(__name__)


class WallboxConnector(BaseConnector):
    """Generischer Wallbox-Connector (REST-API basiert)."""

    def __init__(self, base_url: str, api_key: str = ""):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._connected = False

    async def connect(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/status",
                    headers=self._headers(),
                    timeout=5.0,
                )
                self._connected = response.status_code == 200
                return self._connected
        except Exception:
            logger.exception("Wallbox connection failed")
            return False

    async def disconnect(self) -> None:
        self._connected = False

    async def read_values(self) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/status",
                    headers=self._headers(),
                    timeout=5.0,
                )
                response.raise_for_status()
                return response.json()
        except Exception:
            logger.exception("Wallbox read failed")
            return {}

    async def write_setpoint(self, key: str, value: Any) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/control",
                    headers=self._headers(),
                    json={key: value},
                    timeout=5.0,
                )
                return response.status_code == 200
        except Exception:
            logger.exception("Wallbox write failed")
            return False

    async def is_connected(self) -> bool:
        return self._connected

    async def set_charging_power(self, power_kw: float) -> bool:
        """Setze die Ladeleistung der Wallbox."""
        return await self.write_setpoint("max_power_kw", power_kw)

    async def start_charging(self) -> bool:
        return await self.write_setpoint("command", "start")

    async def stop_charging(self) -> bool:
        return await self.write_setpoint("command", "stop")

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
