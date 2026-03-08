"""Basis-Klasse für alle Prognose-Module."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass
class ForecastPoint:
    timestamp: datetime
    value_kw: float
    confidence_lower: float | None = None
    confidence_upper: float | None = None


class BaseForecaster(ABC):
    """Abstrakte Basis-Klasse für Prognosen."""

    @abstractmethod
    async def forecast(
        self, start: datetime, end: datetime, resolution_minutes: int = 15
    ) -> list[ForecastPoint]:
        """Erstelle eine Prognose für den angegebenen Zeitraum."""
        ...

    @abstractmethod
    async def get_model_version(self) -> str:
        """Aktuelle Modellversion."""
        ...
