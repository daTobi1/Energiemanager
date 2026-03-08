from datetime import datetime, timedelta, timezone

from app.forecasting.load_forecast import LoadForecaster
from app.forecasting.pv_forecast import PVForecaster


async def test_pv_forecast_returns_points():
    forecaster = PVForecaster(peak_power_kwp=10.0)
    now = datetime.now(timezone.utc)
    points = await forecaster.forecast(now, now + timedelta(hours=24))
    assert len(points) > 0
    assert all(p.value_kw >= 0 for p in points)


async def test_load_forecast_returns_points():
    forecaster = LoadForecaster(annual_consumption_kwh=5000.0)
    now = datetime.now(timezone.utc)
    points = await forecaster.forecast(now, now + timedelta(hours=24))
    assert len(points) > 0
    assert all(p.value_kw >= 0 for p in points)


async def test_pv_forecast_zero_at_night():
    forecaster = PVForecaster(peak_power_kwp=10.0)
    # Create a time at midnight
    midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    points = await forecaster.forecast(midnight, midnight + timedelta(hours=4))
    # Nachts sollte PV 0 sein
    assert all(p.value_kw == 0 for p in points)
