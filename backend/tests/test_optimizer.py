"""Tests fuer den Energie-Optimierer (Scoring-Funktionen)."""

from app.services.optimizer import EnergyOptimizer


class TestScoringFunctions:
    """Tests fuer die 5 Bewertungskriterien."""

    def setup_method(self):
        self.opt = EnergyOptimizer()

    def test_economy_no_grid_perfect_score(self):
        score, cost = self.opt._score_economy(
            grid_kw=0, tariff_ct=30, feed_in_ct=8,
            boiler_kw=0, gas_price_ct=8,
        )
        assert score == 1.0
        assert cost == 0.0

    def test_economy_export_earns_revenue(self):
        score, cost = self.opt._score_economy(
            grid_kw=-5.0, tariff_ct=30, feed_in_ct=8,
            boiler_kw=0, gas_price_ct=8,
        )
        assert cost < 0, "Einspeisung muss negative Kosten ergeben"
        assert score == 1.0

    def test_economy_high_import_low_score(self):
        score, cost = self.opt._score_economy(
            grid_kw=10.0, tariff_ct=30, feed_in_ct=8,
            boiler_kw=0, gas_price_ct=8,
        )
        assert cost > 0
        assert score < 0.5

    def test_co2_no_fossil_perfect(self):
        score, co2 = self.opt._score_co2(grid_kw=0, boiler_kw=0, pv_self_kw=5.0)
        assert score == 1.0
        assert co2 == 0.0

    def test_co2_grid_import_produces_co2(self):
        score, co2 = self.opt._score_co2(grid_kw=5.0, boiler_kw=0, pv_self_kw=0)
        assert co2 > 0
        assert score < 1.0

    def test_comfort_on_target(self):
        score = self.opt._score_comfort(storage_temp=55, target_temp=55, hysteresis=3)
        assert score == 1.0

    def test_comfort_within_hysteresis(self):
        score = self.opt._score_comfort(storage_temp=53, target_temp=55, hysteresis=3)
        assert score == 1.0

    def test_comfort_far_from_target(self):
        score = self.opt._score_comfort(storage_temp=35, target_temp=55, hysteresis=3)
        assert score < 0.5

    def test_self_consumption_full(self):
        score = self.opt._score_self_consumption(pv_kw=5.0, self_consumed_kw=5.0)
        assert score == 1.0

    def test_self_consumption_half(self):
        score = self.opt._score_self_consumption(pv_kw=10.0, self_consumed_kw=5.0)
        assert score == 0.5

    def test_self_consumption_night(self):
        score = self.opt._score_self_consumption(pv_kw=0, self_consumed_kw=0)
        assert score == 0.5  # Irrelevant nachts

    def test_grid_friendly_low_load(self):
        score = self.opt._score_grid_friendly(grid_kw=2.0, avg_grid_kw=2.0)
        assert score >= 0.5

    def test_weighted_score(self):
        weights = {"economy": 100, "co2Reduction": 0, "comfort": 0, "selfConsumption": 0, "gridFriendly": 0}
        scores = {"economy": 0.8, "co2": 0.5, "comfort": 0.5, "self_consumption": 0.5, "grid_friendly": 0.5}
        result = self.opt._weighted_score(weights, scores)
        assert result == 0.8

    def test_tariff_fixed(self):
        settings = {"tariffType": "fixed", "gridConsumptionCtPerKwh": 25}
        price = self.opt._get_tariff_ct(settings, hour=12, weekday=0)
        assert price == 25

    def test_tariff_dynamic_night_cheaper(self):
        settings = {"tariffType": "dynamic", "gridConsumptionCtPerKwh": 30}
        night = self.opt._get_tariff_ct(settings, hour=3, weekday=0)
        day = self.opt._get_tariff_ct(settings, hour=12, weekday=0)
        assert night < day
