"""Tests fuer die Readiness-Berechnung (ML-Modell-Bereitschaft)."""

from datetime import datetime, timedelta, timezone

from app.services.ml.readiness import calculate_readiness


class TestReadinessScore:
    """Tests fuer calculate_readiness()."""

    def test_untrained_model_not_ready(self):
        r = calculate_readiness("pv_correction", 0, 0.0, 0.0, None)
        assert r["level"] == "learning"
        assert r["can_activate"] is False
        assert r["score"] < 0.5

    def test_minimal_samples_not_enough(self):
        """Weniger als 168 Samples darf nicht aktiviert werden."""
        r = calculate_readiness(
            "pv_correction", 100, 0.5, 0.3,
            datetime.now(timezone.utc),
        )
        assert r["can_activate"] is False

    def test_low_r2_blocks_activation(self):
        """R2 < 0.3 darf nicht aktiviert werden, auch mit genug Daten."""
        r = calculate_readiness(
            "pv_correction", 500, 0.2, 0.3,
            datetime.now(timezone.utc),
        )
        assert r["can_activate"] is False

    def test_ready_model_can_activate(self):
        """Genug Daten + guter R2 → aktivierbar."""
        r = calculate_readiness(
            "pv_correction", 500, 0.6, 0.4,
            datetime.now(timezone.utc),
        )
        assert r["can_activate"] is True
        assert r["level"] in ("ready", "excellent")
        assert r["score"] >= 0.5

    def test_excellent_model(self):
        """Viele Daten + hoher R2 + niedriger MAE → excellent."""
        r = calculate_readiness(
            "pv_correction", 3000, 0.9, 0.1,
            datetime.now(timezone.utc),
        )
        assert r["level"] == "excellent"
        assert r["can_activate"] is True
        assert r["score"] >= 0.8

    def test_freshness_degrades_over_time(self):
        now = datetime.now(timezone.utc)
        r_fresh = calculate_readiness("pv_correction", 500, 0.6, 0.3, now)
        r_stale = calculate_readiness(
            "pv_correction", 500, 0.6, 0.3,
            now - timedelta(days=10),
        )
        assert r_fresh["criteria"]["freshness"] > r_stale["criteria"]["freshness"]
        assert r_fresh["score"] > r_stale["score"]

    def test_data_score_scaling(self):
        """Mehr Daten → hoeherer data-Score."""
        now = datetime.now(timezone.utc)
        r_low = calculate_readiness("load_correction", 168, 0.5, 0.3, now)
        r_mid = calculate_readiness("load_correction", 720, 0.5, 0.3, now)
        r_high = calculate_readiness("load_correction", 2160, 0.5, 0.3, now)

        assert r_low["criteria"]["data"] < r_mid["criteria"]["data"]
        assert r_mid["criteria"]["data"] < r_high["criteria"]["data"]

    def test_error_score_inverse_of_mae(self):
        """Niedriger MAE → hoeherer error-Score."""
        now = datetime.now(timezone.utc)
        r_good = calculate_readiness("thermal_correction", 500, 0.5, 0.1, now)
        r_bad = calculate_readiness("thermal_correction", 500, 0.5, 0.8, now)
        assert r_good["criteria"]["error"] > r_bad["criteria"]["error"]

    def test_all_criteria_present(self):
        r = calculate_readiness("pv_correction", 100, 0.3, 0.5, None)
        assert "data" in r["criteria"]
        assert "accuracy" in r["criteria"]
        assert "error" in r["criteria"]
        assert "freshness" in r["criteria"]
        assert 0 <= r["criteria"]["data"] <= 1
        assert 0 <= r["criteria"]["accuracy"] <= 1
        assert 0 <= r["criteria"]["error"] <= 1
        assert 0 <= r["criteria"]["freshness"] <= 1

    def test_recommendation_not_empty(self):
        """Empfehlung ist immer ein nicht-leerer String."""
        r = calculate_readiness("pv_correction", 0, 0.0, 0.0, None)
        assert isinstance(r["recommendation"], str)
        assert len(r["recommendation"]) > 5

    def test_different_forecast_types(self):
        """Alle drei Forecast-Typen funktionieren."""
        now = datetime.now(timezone.utc)
        for ft in ("pv_correction", "load_correction", "thermal_correction"):
            r = calculate_readiness(ft, 300, 0.5, 0.3, now)
            assert r["level"] in ("not_ready", "learning", "ready", "excellent")
            assert 0 <= r["score"] <= 1

    def test_score_is_weighted_sum(self):
        """Score muss zwischen 0 und 1 liegen."""
        now = datetime.now(timezone.utc)
        r = calculate_readiness("pv_correction", 500, 0.6, 0.3, now)
        assert 0 <= r["score"] <= 1.0

    def test_activation_threshold_boundary(self):
        """Exakt an der Grenze: score >= 0.5, R2 >= 0.3, samples >= 168."""
        now = datetime.now(timezone.utc)
        # Knapp drueber
        r = calculate_readiness("pv_correction", 168, 0.3, 0.5, now)
        # Score koennte knapp sein, aber R2 und Samples erfuellt
        if r["score"] >= 0.5:
            assert r["can_activate"] is True
        else:
            assert r["can_activate"] is False
