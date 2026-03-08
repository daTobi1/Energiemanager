"""Abstrakte Basis-Klasse für Hardware-Connectoren."""

from abc import ABC, abstractmethod
from typing import Any


class BaseConnector(ABC):
    """Schnittstelle zu physischer Hardware (Wechselrichter, Wallboxen, etc.)."""

    @abstractmethod
    async def connect(self) -> bool:
        """Verbindung herstellen."""
        ...

    @abstractmethod
    async def disconnect(self) -> None:
        """Verbindung trennen."""
        ...

    @abstractmethod
    async def read_values(self) -> dict[str, Any]:
        """Aktuelle Messwerte lesen."""
        ...

    @abstractmethod
    async def write_setpoint(self, key: str, value: Any) -> bool:
        """Sollwert schreiben."""
        ...

    @abstractmethod
    async def is_connected(self) -> bool:
        """Verbindungsstatus prüfen."""
        ...
