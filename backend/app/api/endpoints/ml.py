"""
ML-Endpoints — Training, Status und Genauigkeitsvergleich.

GET  /ml/status                — Status aller ML-Modelle
GET  /ml/status/{forecast_type} — Detail-Status eines Modells
POST /ml/train                 — Alle Modelle trainieren
POST /ml/train/{forecast_type} — Ein Modell trainieren
GET  /ml/accuracy/{forecast_type} — Physik vs. Hybrid Vergleich
DELETE /ml/models/{forecast_type} — Modell loeschen
"""

import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.config import settings
from app.core.database import async_session
from app.models.ml_status import MLModelStatus
from app.services.ml.predictor import ml_predictor
from app.services.ml.trainer import FORECAST_TYPES, ml_trainer

router = APIRouter()


@router.get("/status")
async def get_ml_status():
    """Status aller ML-Modelle."""
    models = []
    try:
        async with async_session() as db:
            result = await db.execute(select(MLModelStatus))
            for row in result.scalars():
                models.append({
                    "forecast_type": row.id,
                    "model_type": row.model_type,
                    "is_trained": row.is_active,
                    "trained_at": row.trained_at.isoformat() if row.trained_at else None,
                    "training_samples": row.training_samples,
                    "feature_count": row.feature_count,
                    "mae": row.mae,
                    "rmse": row.rmse,
                    "r2_score": row.r2_score,
                    "is_active": row.is_active,
                })
    except Exception:
        pass

    # Untrained models auffuellen
    known = {m["forecast_type"] for m in models}
    for ft in FORECAST_TYPES:
        if ft not in known:
            models.append({
                "forecast_type": ft,
                "model_type": "xgboost",
                "is_trained": False,
                "trained_at": None,
                "training_samples": 0,
                "feature_count": 0,
                "mae": 0,
                "rmse": 0,
                "r2_score": 0,
                "is_active": False,
            })

    return {
        "models": models,
        "loaded_models": ml_predictor.loaded_models,
        "model_dir": settings.ml_model_dir,
    }


@router.get("/status/{forecast_type}")
async def get_ml_status_detail(forecast_type: str):
    """Detail-Status eines ML-Modells inkl. Feature-Importance."""
    try:
        async with async_session() as db:
            result = await db.execute(
                select(MLModelStatus).where(MLModelStatus.id == forecast_type)
            )
            row = result.scalar_one_or_none()
            if row:
                return {
                    "forecast_type": row.id,
                    "model_type": row.model_type,
                    "version": row.version,
                    "is_trained": row.is_active,
                    "trained_at": row.trained_at.isoformat() if row.trained_at else None,
                    "training_samples": row.training_samples,
                    "feature_count": row.feature_count,
                    "mae": row.mae,
                    "rmse": row.rmse,
                    "r2_score": row.r2_score,
                    "model_path": row.model_path,
                    "is_active": row.is_active,
                    "metadata": row.metadata_json,
                    "is_loaded": forecast_type in ml_predictor.loaded_models,
                }
    except Exception:
        pass

    return {
        "forecast_type": forecast_type,
        "is_trained": False,
        "is_loaded": False,
    }


@router.post("/train")
async def train_all_models(days_back: int = Query(90, ge=7, le=365)):
    """Trainiert alle ML-Korrektur-Modelle."""
    results = await ml_trainer.train_all(days_back)
    ml_predictor.reload_models()
    return {"status": "Training abgeschlossen", "results": results}


@router.post("/train/{forecast_type}")
async def train_model(forecast_type: str, days_back: int = Query(90, ge=7, le=365)):
    """Trainiert ein einzelnes ML-Korrektur-Modell."""
    if forecast_type not in FORECAST_TYPES:
        return {"error": f"Unbekannter Typ: {forecast_type}. Erlaubt: {FORECAST_TYPES}"}

    result = await ml_trainer.train(forecast_type, days_back)
    if result.get("success"):
        ml_predictor.reload_models()
    return result


@router.delete("/models/{forecast_type}")
async def delete_model(forecast_type: str):
    """Loescht ein ML-Modell (Fallback auf reine Physik-Prognose)."""
    model_dir = Path(settings.ml_model_dir)
    deleted = []

    for suffix in ["_latest.joblib", "_lower.joblib", "_upper.joblib"]:
        path = model_dir / f"{forecast_type}{suffix}"
        if path.exists():
            os.remove(path)
            deleted.append(str(path))

    # DB-Status deaktivieren
    try:
        async with async_session() as db:
            result = await db.execute(
                select(MLModelStatus).where(MLModelStatus.id == forecast_type)
            )
            entry = result.scalar_one_or_none()
            if entry:
                entry.is_active = False
                await db.commit()
    except Exception:
        pass

    ml_predictor.reload_models()
    return {"status": "Modell geloescht", "deleted": deleted}
