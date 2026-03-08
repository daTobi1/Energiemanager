"""PV-Erzeugungsprognose."""

from datetime import datetime

from app.forecasting.base import BaseForecaster, ForecastPoint
from app.forecasting.weather import WeatherService


class PVForecaster(BaseForecaster):
    """Prognostiziert PV-Erzeugung basierend auf Wetterdaten."""

    def __init__(self, peak_power_kwp: float = 10.0, system_efficiency: float = 0.85):
        self.peak_power_kwp = peak_power_kwp
        self.system_efficiency = system_efficiency
        self.weather = WeatherService()

    async def forecast(
        self, start: datetime, end: datetime, resolution_minutes: int = 15
    ) -> list[ForecastPoint]:
        weather_data = await self.weather.get_forecast(hours=48)

        points = []
        for w in weather_data:
            if w.timestamp < start or w.timestamp > end:
                continue

            # Einfaches Modell: P = P_peak * GHI/1000 * (1 - clouds/100) * efficiency
            cloud_factor = 1 - (w.cloud_cover_pct / 100) * 0.7  # Bewölkung reduziert nicht 100%
            pv_power = (
                self.peak_power_kwp
                * (w.ghi_w_per_m2 / 1000)
                * cloud_factor
                * self.system_efficiency
            )

            points.append(
                ForecastPoint(
                    timestamp=w.timestamp,
                    value_kw=max(0, pv_power),
                    confidence_lower=max(0, pv_power * 0.7),
                    confidence_upper=pv_power * 1.3,
                )
            )

        return points

    async def get_model_version(self) -> str:
        return "rule_based_v1"
