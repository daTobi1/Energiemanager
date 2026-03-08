from app.services.optimizer import Optimizer


def test_surplus_charges_battery():
    optimizer = Optimizer()
    result = optimizer.optimize_step(
        pv_forecast_kw=8.0,
        load_forecast_kw=3.0,
        heat_demand_kw=0.0,
        battery_soc_pct=50.0,
        battery_capacity_kwh=10.0,
        charging_demands={},
    )
    # 5 kW surplus should charge battery
    assert result.storage_setpoints.get(1, 0) > 0
    assert result.grid_power_kw <= 0  # No grid draw


def test_deficit_discharges_battery():
    optimizer = Optimizer()
    result = optimizer.optimize_step(
        pv_forecast_kw=1.0,
        load_forecast_kw=5.0,
        heat_demand_kw=0.0,
        battery_soc_pct=60.0,
        battery_capacity_kwh=10.0,
        charging_demands={},
    )
    # Battery should discharge
    assert result.storage_setpoints.get(1, 0) < 0


def test_charging_demand_served():
    optimizer = Optimizer()
    result = optimizer.optimize_step(
        pv_forecast_kw=10.0,
        load_forecast_kw=3.0,
        heat_demand_kw=0.0,
        battery_soc_pct=50.0,
        battery_capacity_kwh=10.0,
        charging_demands={1: 5.0},
    )
    assert result.charging_setpoints[1] == 5.0
