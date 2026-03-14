"""
Seed-Script: Erzeugt realistische Beispieldaten fuer die Selbstlernung-Seite.

Erstellt:
- 3 ML-Modell-Statuseintraege (pv, load, thermal) mit verschiedenen Zustaenden
- Gelernte thermische Parameter fuer alle Raeume mit Heizkreis
"""

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Backend-Modul importierbar machen
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.core.database import async_session, engine  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.models import config as _  # noqa: E402, F401
from app.models import ml_status as _m  # noqa: E402, F401
from app.models import thermal_params as _t  # noqa: E402, F401
from app.models import weather as _w  # noqa: E402, F401
from app.models import alarm as _a  # noqa: E402, F401
from app.models import user as _u  # noqa: E402, F401
from app.models.ml_status import MLModelStatus  # noqa: E402
from app.models.thermal_params import ThermalLearnedParams  # noqa: E402
from app.models.config import RoomConfig  # noqa: E402
from sqlalchemy import select  # noqa: E402


async def seed_ml_models():
    """Erstellt 3 ML-Modelle mit unterschiedlichen Zustaenden."""
    now = datetime.now(timezone.utc)

    models = [
        # PV-Korrektur: gut trainiert, passiv, bereit fuer Aktivierung
        MLModelStatus(
            id="pv_correction",
            model_type="xgboost",
            version="v1",
            trained_at=now - timedelta(hours=6),
            training_samples=876,
            feature_count=15,
            mae=0.34,
            rmse=0.52,
            r2_score=0.72,
            model_path="ml_models/pv_correction_latest.joblib",
            is_active=True,
            activation_mode="passive",
            metadata_json={
                "feature_importance": {
                    "ghi_wm2": 0.312,
                    "hour_sin": 0.187,
                    "cloud_cover_pct": 0.142,
                    "solar_altitude_deg": 0.098,
                    "physics_baseline_kw": 0.087,
                    "outdoor_temp_c": 0.054,
                    "month_sin": 0.041,
                    "hour_cos": 0.032,
                    "dni_wm2": 0.021,
                    "dhi_wm2": 0.015,
                    "wind_speed_ms": 0.005,
                    "weekday_sin": 0.003,
                    "weekday_cos": 0.002,
                    "month_cos": 0.001,
                    "is_weekend": 0.000,
                },
            },
        ),
        # Last-Korrektur: maessig trainiert, passiv, lernend
        MLModelStatus(
            id="load_correction",
            model_type="xgboost",
            version="v1",
            trained_at=now - timedelta(hours=6),
            training_samples=432,
            feature_count=12,
            mae=0.41,
            rmse=0.58,
            r2_score=0.48,
            model_path="ml_models/load_correction_latest.joblib",
            is_active=True,
            activation_mode="passive",
            metadata_json={
                "feature_importance": {
                    "hour_sin": 0.245,
                    "hour_cos": 0.178,
                    "physics_baseline_kw": 0.132,
                    "outdoor_temp_c": 0.098,
                    "is_weekend": 0.087,
                    "weekday_sin": 0.065,
                    "weekday_cos": 0.054,
                    "cloud_cover_pct": 0.043,
                    "humidity_pct": 0.038,
                    "month_sin": 0.032,
                    "month_cos": 0.018,
                    "wind_speed_ms": 0.010,
                },
            },
        ),
        # Thermische Korrektur: wenig trainiert, noch lernend
        MLModelStatus(
            id="thermal_correction",
            model_type="xgboost",
            version="v1",
            trained_at=now - timedelta(hours=6),
            training_samples=198,
            feature_count=12,
            mae=0.52,
            rmse=0.71,
            r2_score=0.35,
            model_path="ml_models/thermal_correction_latest.joblib",
            is_active=True,
            activation_mode="passive",
            metadata_json={
                "feature_importance": {
                    "outdoor_temp_c": 0.298,
                    "heating_demand_kw": 0.215,
                    "physics_baseline_kw": 0.142,
                    "hour_sin": 0.098,
                    "hour_cos": 0.067,
                    "cloud_cover_pct": 0.054,
                    "month_sin": 0.043,
                    "wind_speed_ms": 0.032,
                    "weekday_sin": 0.021,
                    "month_cos": 0.015,
                    "is_weekend": 0.010,
                    "weekday_cos": 0.005,
                },
            },
        ),
    ]

    async with async_session() as db:
        # Bestehende loeschen
        for ft in ("pv_correction", "load_correction", "thermal_correction"):
            result = await db.execute(select(MLModelStatus).where(MLModelStatus.id == ft))
            existing = result.scalar_one_or_none()
            if existing:
                await db.delete(existing)
        await db.commit()

        # Neue einfuegen
        for m in models:
            db.add(m)
        await db.commit()

    print(f"  3 ML-Modelle erstellt (PV: ready, Last: learning, Thermal: learning)")
    return models


async def seed_thermal_params():
    """Erstellt gelernte thermische Parameter fuer alle Raeume mit Heizkreis."""
    now = datetime.now(timezone.utc)
    count = 0

    async with async_session() as db:
        # Raeume laden
        result = await db.execute(select(RoomConfig))
        rooms = [r.data for r in result.scalars()]

    if not rooms:
        print("  Keine Raeume vorhanden — uebersprungen")
        return

    # Verschiedene Lern-Zustaende simulieren
    room_params = [
        # Raum 0: voll gelernt (FBH)
        {"tau_response_h": 2.45, "tau_loss_h": 42.3, "steepness": 1.15, "shift": 0.5, "points": 312, "status": "learned"},
        # Raum 1: voll gelernt (Radiator)
        {"tau_response_h": 0.38, "tau_loss_h": 35.8, "steepness": 1.28, "shift": -0.3, "points": 287, "status": "learned"},
        # Raum 2: voll gelernt
        {"tau_response_h": 0.42, "tau_loss_h": 38.1, "steepness": 1.22, "shift": 0.2, "points": 256, "status": "learned"},
        # Raum 3: lernend (wenig Daten)
        {"tau_response_h": 0.50, "tau_loss_h": 40.0, "steepness": 1.20, "shift": 0.0, "points": 78, "status": "learning"},
        # Raum 4: lernend
        {"tau_response_h": 2.30, "tau_loss_h": 45.2, "steepness": 1.10, "shift": 0.8, "points": 95, "status": "learning"},
        # Raum 5: wartend (zu wenig Daten)
        {"tau_response_h": None, "tau_loss_h": None, "steepness": None, "shift": None, "points": 12, "status": "waiting"},
    ]

    async with async_session() as db:
        for i, room in enumerate(rooms):
            room_id = room.get("id", "")
            if not room_id or not room.get("heatingCircuitId"):
                continue

            params_idx = min(i, len(room_params) - 1)
            p = room_params[params_idx]

            data = {
                "room_id": room_id,
                "room_name": room.get("name", room_id),
                "circuit_id": room.get("heatingCircuitId", ""),
                "circuit_type": "floor_heating" if i in (0, 4) else "radiator",
                "tau_response_h": p["tau_response_h"],
                "tau_loss_h": p["tau_loss_h"],
                "heating_curve_steepness": p["steepness"],
                "heating_curve_parallel_shift": p["shift"],
                "data_points": p["points"],
            }

            if p["status"] == "learned":
                data["learned_at"] = (now - timedelta(hours=6)).isoformat()
            elif p["status"] == "learning":
                data["learned_at"] = None

            # Bestehenden loeschen
            result = await db.execute(select(ThermalLearnedParams).where(ThermalLearnedParams.id == room_id))
            existing = result.scalar_one_or_none()
            if existing:
                await db.delete(existing)

            if p["status"] != "waiting":
                db.add(ThermalLearnedParams(id=room_id, data=data))
            count += 1

        await db.commit()

    print(f"  {count} thermische Raumparameter erstellt (gelernt + lernend + wartend)")


async def main():
    # Tabellen sicherstellen
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("Selbstlernung-Testdaten werden erstellt...")
    print()

    await seed_ml_models()
    await seed_thermal_params()

    print()
    print("Fertig! Self-Learning-Seite sollte jetzt Daten anzeigen.")
    print("  GET http://localhost:8000/api/v1/self-learning/status")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
