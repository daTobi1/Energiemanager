"""Lastprognose (Stromverbrauch)."""

import math
from datetime import datetime, timedelta, timezone

from app.forecasting.base import BaseForecaster, ForecastPoint


class LoadForecaster(BaseForecaster):
    """Prognostiziert Stromverbrauch basierend auf Standardlastprofilen."""

    def __init__(self, annual_consumption_kwh: float = 5000.0):
        self.annual_consumption_kwh = annual_consumption_kwh

    async def forecast(
        self, start: datetime, end: datetime, resolution_minutes: int = 15
    ) -> list[ForecastPoint]:
        points = []
        current = start
        step = timedelta(minutes=resolution_minutes)

        while current <= end:
            load_kw = self._standard_load_profile(current)
            points.append(
                ForecastPoint(
                    timestamp=current,
                    value_kw=load_kw,
                    confidence_lower=load_kw * 0.8,
                    confidence_upper=load_kw * 1.2,
                )
            )
            current += step

        return points

    def _standard_load_profile(self, timestamp: datetime) -> float:
        """Vereinfachtes Standardlastprofil (H0-ähnlich)."""
        hour = timestamp.hour + timestamp.minute / 60
        weekday = timestamp.weekday()
        is_weekend = weekday >= 5

        # Basis-Tagesprofil (normiert auf Durchschnitt = 1.0)
        if is_weekend:
            profile = 0.4 + 0.6 * math.exp(-((hour - 11) ** 2) / 8)
            profile += 0.5 * math.exp(-((hour - 18) ** 2) / 6)
        else:
            profile = 0.3 + 0.4 * math.exp(-((hour - 7) ** 2) / 4)
            profile += 0.3 * math.exp(-((hour - 12) ** 2) / 6)
            profile += 0.6 * math.exp(-((hour - 19) ** 2) / 6)

        # Skalierung auf kW
        avg_power_kw = self.annual_consumption_kwh / 8760
        return avg_power_kw * profile * 2  # Faktor 2 da Profile-Peak > Durchschnitt

    async def get_model_version(self) -> str:
        return "rule_based_v1"
