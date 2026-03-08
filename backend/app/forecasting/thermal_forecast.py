"""Wärme- und Kältebedarfsprognose."""

from datetime import datetime, timedelta

from app.forecasting.base import BaseForecaster, ForecastPoint
from app.forecasting.weather import WeatherService


class ThermalForecaster(BaseForecaster):
    """Prognostiziert Wärme-/Kältebedarf basierend auf Außentemperatur."""

    def __init__(
        self,
        heating_threshold_c: float = 15.0,
        cooling_threshold_c: float = 24.0,
        max_heating_kw: float = 20.0,
        max_cooling_kw: float = 10.0,
        forecast_type: str = "heat",  # "heat" oder "cold"
    ):
        self.heating_threshold = heating_threshold_c
        self.cooling_threshold = cooling_threshold_c
        self.max_heating_kw = max_heating_kw
        self.max_cooling_kw = max_cooling_kw
        self.forecast_type = forecast_type
        self.weather = WeatherService()

    async def forecast(
        self, start: datetime, end: datetime, resolution_minutes: int = 15
    ) -> list[ForecastPoint]:
        weather_data = await self.weather.get_forecast(hours=48)

        points = []
        for w in weather_data:
            if w.timestamp < start or w.timestamp > end:
                continue

            if self.forecast_type == "heat":
                demand = self._heat_demand(w.temperature_c)
            else:
                demand = self._cold_demand(w.temperature_c)

            points.append(
                ForecastPoint(
                    timestamp=w.timestamp,
                    value_kw=demand,
                    confidence_lower=demand * 0.8,
                    confidence_upper=demand * 1.2,
                )
            )

        return points

    def _heat_demand(self, temp_c: float) -> float:
        """Wärmebedarf als Funktion der Außentemperatur."""
        if temp_c >= self.heating_threshold:
            return 0.0
        # Linear: volle Leistung bei -10°C, 0 bei threshold
        factor = (self.heating_threshold - temp_c) / (self.heating_threshold + 10)
        return min(self.max_heating_kw, self.max_heating_kw * max(0, factor))

    def _cold_demand(self, temp_c: float) -> float:
        """Kältebedarf als Funktion der Außentemperatur."""
        if temp_c <= self.cooling_threshold:
            return 0.0
        factor = (temp_c - self.cooling_threshold) / 16  # volle Leistung bei 40°C
        return min(self.max_cooling_kw, self.max_cooling_kw * max(0, factor))

    async def get_model_version(self) -> str:
        return "rule_based_v1"
