"""Tests fuer die Self-Learning API-Endpoints."""

import pytest

from app.core.database import async_session
from app.models.ml_status import MLModelStatus


async def _insert_ml_status(**kwargs):
    """Hilfsfunktion: MLModelStatus in die Main-DB einfuegen (die vom Endpoint gelesen wird)."""
    async with async_session() as db:
        db.add(MLModelStatus(**kwargs))
        await db.commit()


@pytest.mark.asyncio
class TestSelfLearningStatus:
    """GET /self-learning/status"""

    async def test_status_empty_db(self, client):
        """Status ohne trainierte Modelle liefert Defaults."""
        resp = await client.get("/api/v1/self-learning/status")
        assert resp.status_code == 200
        data = resp.json()

        assert "ml_models" in data
        assert "thermal_rooms" in data
        assert "overall_readiness" in data
        assert "last_retrain_at" in data
        assert "next_retrain_in_h" in data

        # 3 Modelle (pv, load, thermal) mit Default-Werten
        assert len(data["ml_models"]) == 3
        for model in data["ml_models"]:
            assert model["activation_mode"] == "passive"
            assert model["training_samples"] == 0
            assert model["readiness"]["level"] in ("not_ready", "learning")
            assert model["readiness"]["can_activate"] is False
            assert "display_name" in model

    async def test_status_with_trained_model(self, client):
        """Status mit einem trainierten Modell."""
        from datetime import datetime, timezone

        await _insert_ml_status(
            id="pv_correction",
            model_type="xgboost",
            trained_at=datetime.now(timezone.utc),
            training_samples=500,
            feature_count=8,
            mae=0.3,
            rmse=0.5,
            r2_score=0.65,
            model_path="/tmp/test.joblib",
            is_active=True,
            activation_mode="passive",
        )

        resp = await client.get("/api/v1/self-learning/status")
        assert resp.status_code == 200
        data = resp.json()

        models = data["ml_models"]
        pv_model = next(m for m in models if m["forecast_type"] == "pv_correction")
        assert pv_model["activation_mode"] == "passive"
        assert pv_model["training_samples"] == 500
        assert pv_model["r2_score"] == 0.65
        assert pv_model["readiness"]["can_activate"] is True
        assert pv_model["readiness"]["level"] in ("ready", "excellent")
        assert data["last_retrain_at"] is not None
        assert data["overall_readiness"] > 0

    async def test_status_overall_readiness_average(self, client):
        """overall_readiness ist der Durchschnitt aller Modelle."""
        from datetime import datetime, timezone

        for ft in ("pv_correction", "load_correction", "thermal_correction"):
            await _insert_ml_status(
                id=ft,
                model_type="xgboost",
                trained_at=datetime.now(timezone.utc),
                training_samples=1000,
                feature_count=8,
                mae=0.2,
                rmse=0.3,
                r2_score=0.8,
                model_path=f"/tmp/{ft}.joblib",
                is_active=True,
                activation_mode="passive",
            )

        resp = await client.get("/api/v1/self-learning/status")
        data = resp.json()
        assert data["overall_readiness"] > 0.5


@pytest.mark.asyncio
class TestSelfLearningModeChange:
    """PUT /self-learning/models/{type}/mode"""

    async def test_set_mode_passive(self, client):
        from datetime import datetime, timezone

        await _insert_ml_status(
            id="pv_correction",
            model_type="xgboost",
            trained_at=datetime.now(timezone.utc),
            training_samples=500,
            feature_count=8,
            mae=0.3,
            rmse=0.5,
            r2_score=0.65,
            model_path="/tmp/test.joblib",
            is_active=True,
            activation_mode="passive",
        )

        resp = await client.put("/api/v1/self-learning/models/pv_correction/mode?mode=passive")
        assert resp.status_code == 200
        data = resp.json()
        assert data["activation_mode"] == "passive"

    async def test_set_mode_off(self, client):
        from datetime import datetime, timezone

        await _insert_ml_status(
            id="load_correction",
            model_type="xgboost",
            trained_at=datetime.now(timezone.utc),
            training_samples=200,
            feature_count=6,
            mae=0.5,
            rmse=0.7,
            r2_score=0.4,
            model_path="/tmp/test.joblib",
            is_active=True,
            activation_mode="passive",
        )

        resp = await client.put("/api/v1/self-learning/models/load_correction/mode?mode=off")
        assert resp.status_code == 200
        assert resp.json()["activation_mode"] == "off"

    async def test_set_mode_active_with_readiness(self, client):
        """Aktivierung nur wenn Readiness gegeben."""
        from datetime import datetime, timezone

        await _insert_ml_status(
            id="pv_correction",
            model_type="xgboost",
            trained_at=datetime.now(timezone.utc),
            training_samples=500,
            feature_count=8,
            mae=0.3,
            rmse=0.5,
            r2_score=0.65,
            model_path="/tmp/test.joblib",
            is_active=True,
            activation_mode="passive",
        )

        resp = await client.put("/api/v1/self-learning/models/pv_correction/mode?mode=active")
        assert resp.status_code == 200
        assert resp.json()["activation_mode"] == "active"

    async def test_set_mode_active_blocked_if_not_ready(self, client):
        """Aktivierung wird blockiert wenn Readiness nicht gegeben."""
        from datetime import datetime, timezone

        await _insert_ml_status(
            id="pv_correction",
            model_type="xgboost",
            trained_at=datetime.now(timezone.utc),
            training_samples=50,  # Zu wenig
            feature_count=8,
            mae=1.5,
            rmse=2.0,
            r2_score=0.1,  # Zu niedrig
            model_path="/tmp/test.joblib",
            is_active=True,
            activation_mode="passive",
        )

        resp = await client.put("/api/v1/self-learning/models/pv_correction/mode?mode=active")
        assert resp.status_code == 400

    async def test_set_mode_active_untrained_blocked(self, client):
        """Aktivierung ohne Training wird blockiert."""
        resp = await client.put("/api/v1/self-learning/models/pv_correction/mode?mode=active")
        assert resp.status_code == 400

    async def test_set_mode_invalid_type(self, client):
        resp = await client.put("/api/v1/self-learning/models/nonexistent/mode?mode=passive")
        assert resp.status_code == 400

    async def test_set_mode_invalid_mode(self, client):
        resp = await client.put("/api/v1/self-learning/models/pv_correction/mode?mode=turbo")
        assert resp.status_code == 400

    async def test_mode_persists_after_set(self, client):
        """Modus bleibt nach Setzen erhalten."""
        from datetime import datetime, timezone

        await _insert_ml_status(
            id="thermal_correction",
            model_type="xgboost",
            trained_at=datetime.now(timezone.utc),
            training_samples=300,
            feature_count=6,
            mae=0.3,
            rmse=0.4,
            r2_score=0.55,
            model_path="/tmp/test.joblib",
            is_active=True,
            activation_mode="passive",
        )

        # Auf off setzen
        resp = await client.put("/api/v1/self-learning/models/thermal_correction/mode?mode=off")
        assert resp.status_code == 200

        # Status pruefen
        resp = await client.get("/api/v1/self-learning/status")
        data = resp.json()
        thermal = next(m for m in data["ml_models"] if m["forecast_type"] == "thermal_correction")
        assert thermal["activation_mode"] == "off"


@pytest.mark.asyncio
class TestSelfLearningTrain:
    """POST /self-learning/models/{type}/train"""

    async def test_train_invalid_type(self, client):
        resp = await client.post("/api/v1/self-learning/models/nonexistent/train")
        assert resp.status_code == 400

    async def test_train_no_data(self, client):
        """Training ohne Messdaten liefert Fehlermeldung."""
        resp = await client.post("/api/v1/self-learning/models/pv_correction/train")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "Zu wenig Daten" in data.get("error", "")


@pytest.mark.asyncio
class TestSelfLearningThermal:
    """POST /self-learning/thermal/learn"""

    async def test_thermal_learn_no_rooms(self, client):
        """Thermisches Lernen ohne Raeume liefert leere Ergebnisse."""
        resp = await client.post("/api/v1/self-learning/thermal/learn")
        assert resp.status_code == 200
        data = resp.json()
        assert data["rooms_total"] == 0
        assert data["rooms_learned"] == 0


@pytest.mark.asyncio
class TestPredictorActivationGate:
    """Tests fuer das Activation-Gate im Predictor."""

    async def test_predictor_passive_returns_zero(self, client):
        """Im Passiv-Modus gibt predict_correction() Nullen zurueck."""
        from app.services.ml.predictor import ml_predictor

        ml_predictor.set_activation_mode("pv_correction", "passive")
        mode = ml_predictor.get_activation_mode("pv_correction")
        assert mode == "passive"

    async def test_predictor_off_returns_zero(self, client):
        """Im Off-Modus gibt predict_correction() Nullen zurueck."""
        from app.services.ml.predictor import ml_predictor

        ml_predictor.set_activation_mode("pv_correction", "off")
        correction, lower, upper = ml_predictor.predict_correction("pv_correction", {})
        assert correction == 0.0
        assert lower == 0.0
        assert upper == 0.0

    async def test_predictor_mode_persistence(self, client):
        """Modus-Aenderungen bleiben im Predictor erhalten."""
        from app.services.ml.predictor import ml_predictor

        ml_predictor.set_activation_mode("load_correction", "active")
        assert ml_predictor.get_activation_mode("load_correction") == "active"

        ml_predictor.set_activation_mode("load_correction", "off")
        assert ml_predictor.get_activation_mode("load_correction") == "off"

    async def test_passive_correction_stored(self, client):
        """Passive Korrektur wird gespeichert (Default 0 wenn kein Modell)."""
        from app.services.ml.predictor import ml_predictor

        val = ml_predictor.get_passive_correction("pv_correction")
        assert isinstance(val, float)
