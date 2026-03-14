"""
Self-Learning Endpoints — Modell-Steuerung und Readiness-Uebersicht.

GET  /self-learning/status                  — Gesamtstatus aller Modelle + Thermal-Rooms + Readiness
PUT  /self-learning/models/{type}/mode      — Modus aendern (passive/active/off)
POST /self-learning/models/{type}/train     — Manuelles Training
POST /self-learning/thermal/learn           — Manuelles Thermal-Lernen
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.core.database import async_session
from app.models.ml_status import MLModelStatus
from app.models.thermal_params import ThermalLearnedParams
from app.services.ml.predictor import ml_predictor
from app.services.ml.readiness import calculate_readiness
from app.services.ml.trainer import FORECAST_TYPES, ml_trainer

logger = logging.getLogger(__name__)

router = APIRouter()

VALID_MODES = ("passive", "active", "off")

# Anzeigenamen fuer Forecast-Typen
DISPLAY_NAMES = {
    "pv_correction": "PV-Korrektur",
    "load_correction": "Last-Korrektur",
    "thermal_correction": "Waerme-Korrektur",
}


@router.get("/status")
async def get_self_learning_status():
    """Gesamtstatus: ML-Modelle + Thermische Raeume + Readiness."""
    ml_models = []
    last_retrain_at = None

    try:
        async with async_session() as db:
            result = await db.execute(select(MLModelStatus))
            for row in result.scalars():
                trained_at = row.trained_at
                readiness = calculate_readiness(
                    row.id, row.training_samples, row.r2_score, row.mae, trained_at,
                )

                # Activation-Mode aus DB laden und Predictor synchronisieren
                mode = row.activation_mode or "passive"
                ml_predictor.set_activation_mode(row.id, mode)

                ml_models.append({
                    "forecast_type": row.id,
                    "display_name": DISPLAY_NAMES.get(row.id, row.id),
                    "activation_mode": mode,
                    "training_samples": row.training_samples,
                    "r2_score": row.r2_score,
                    "mae": row.mae,
                    "trained_at": trained_at.isoformat() if trained_at else None,
                    "is_loaded": row.id in ml_predictor.loaded_models,
                    "readiness": readiness,
                    "passive_correction_kw": round(ml_predictor.get_passive_correction(row.id), 3),
                })

                if trained_at and (last_retrain_at is None or trained_at > last_retrain_at):
                    last_retrain_at = trained_at
    except Exception as e:
        logger.warning("ML-Status laden fehlgeschlagen: %s", e)

    # Fehlende Modelle auffuellen
    known = {m["forecast_type"] for m in ml_models}
    for ft in FORECAST_TYPES:
        if ft not in known:
            readiness = calculate_readiness(ft, 0, 0.0, 0.0, None)
            ml_models.append({
                "forecast_type": ft,
                "display_name": DISPLAY_NAMES.get(ft, ft),
                "activation_mode": "passive",
                "training_samples": 0,
                "r2_score": 0.0,
                "mae": 0.0,
                "trained_at": None,
                "is_loaded": False,
                "readiness": readiness,
                "passive_correction_kw": 0.0,
            })

    # Thermische Raeume
    thermal_rooms = await _get_thermal_rooms()

    # Overall readiness
    readiness_scores = [m["readiness"]["score"] for m in ml_models]
    overall_readiness = round(sum(readiness_scores) / len(readiness_scores), 3) if readiness_scores else 0.0

    # Naechstes Retrain berechnen
    now = datetime.now(timezone.utc)
    next_retrain_in_h = None
    if last_retrain_at:
        if last_retrain_at.tzinfo is None:
            last_retrain_at = last_retrain_at.replace(tzinfo=timezone.utc)
        hours_since = (now - last_retrain_at).total_seconds() / 3600
        next_retrain_in_h = round(max(0, 24 - hours_since), 1)

    return {
        "ml_models": ml_models,
        "thermal_rooms": thermal_rooms,
        "overall_readiness": overall_readiness,
        "last_retrain_at": last_retrain_at.isoformat() if last_retrain_at else None,
        "next_retrain_in_h": next_retrain_in_h,
    }


@router.put("/models/{forecast_type}/mode")
async def set_model_mode(forecast_type: str, mode: str = Query(...)):
    """Aktivierungsmodus aendern: passive, active oder off."""
    if forecast_type not in FORECAST_TYPES:
        raise HTTPException(400, f"Unbekannter Typ: {forecast_type}. Erlaubt: {FORECAST_TYPES}")
    if mode not in VALID_MODES:
        raise HTTPException(400, f"Ungueltiger Modus: {mode}. Erlaubt: {list(VALID_MODES)}")

    # Bei 'active' pruefen ob Readiness gegeben
    if mode == "active":
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(MLModelStatus).where(MLModelStatus.id == forecast_type)
                )
                row = result.scalar_one_or_none()
                if not row:
                    raise HTTPException(400, "Modell noch nicht trainiert")

                readiness = calculate_readiness(
                    row.id, row.training_samples, row.r2_score, row.mae, row.trained_at,
                )
                if not readiness["can_activate"]:
                    raise HTTPException(
                        400,
                        f"Modell nicht bereit fuer Aktivierung (Score: {readiness['score']:.2f}). "
                        f"{readiness['recommendation']}",
                    )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Fehler: {e}") from e

    # Modus in DB speichern
    try:
        async with async_session() as db:
            result = await db.execute(
                select(MLModelStatus).where(MLModelStatus.id == forecast_type)
            )
            row = result.scalar_one_or_none()
            if row:
                row.activation_mode = mode
                await db.commit()
            else:
                # Noch kein Eintrag — bei off/passive OK, bei active wurde oben geprüft
                db.add(MLModelStatus(
                    id=forecast_type,
                    activation_mode=mode,
                ))
                await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Speichern fehlgeschlagen: {e}") from e

    # Predictor synchronisieren
    ml_predictor.set_activation_mode(forecast_type, mode)

    return {"forecast_type": forecast_type, "activation_mode": mode}


@router.post("/models/{forecast_type}/train")
async def train_model(forecast_type: str, days_back: int = Query(90, ge=7, le=365)):
    """Manuelles Training eines Modells."""
    if forecast_type not in FORECAST_TYPES:
        raise HTTPException(400, f"Unbekannter Typ: {forecast_type}")

    result = await ml_trainer.train(forecast_type, days_back)
    if result.get("success"):
        ml_predictor.reload_models()
    return result


@router.post("/thermal/learn")
async def learn_thermal(days_back: int = Query(28, ge=7, le=90)):
    """Manuelles thermisches Lernen fuer alle Raeume."""
    from app.services.ml.thermal_learner import thermal_learner

    results = await thermal_learner.learn_all(days_back=days_back)
    success_count = sum(1 for r in results.values() if r.get("success"))
    return {
        "status": "Thermisches Lernen abgeschlossen",
        "rooms_total": len(results),
        "rooms_learned": success_count,
        "results": results,
    }


async def _get_thermal_rooms() -> list[dict]:
    """Laedt thermische Raumparameter und bestimmt Lernstatus."""
    rooms = []

    try:
        from app.models.config import RoomConfig
        async with async_session() as db:
            # Alle Raeume laden
            room_r = await db.execute(select(RoomConfig))
            all_rooms = {r.data.get("id", r.id): r.data for r in room_r.scalars()}

            # Gelernte Parameter laden
            param_r = await db.execute(select(ThermalLearnedParams))
            learned = {p.id: p.data for p in param_r.scalars()}

        for room_id, room_data in all_rooms.items():
            if not room_data.get("heatingCircuitId"):
                continue

            params = learned.get(room_id)
            if params and params.get("learned_at"):
                status = "learned"
                rooms.append({
                    "room_id": room_id,
                    "room_name": room_data.get("name", room_id),
                    "status": status,
                    "data_points": params.get("data_points", 0),
                    "learned_at": params.get("learned_at"),
                    "tau_response_h": params.get("tau_response_h"),
                    "tau_loss_h": params.get("tau_loss_h"),
                    "heating_curve_steepness": params.get("heating_curve_steepness"),
                    "heating_curve_parallel_shift": params.get("heating_curve_parallel_shift"),
                })
            elif params:
                rooms.append({
                    "room_id": room_id,
                    "room_name": room_data.get("name", room_id),
                    "status": "learning",
                    "data_points": params.get("data_points", 0),
                    "learned_at": None,
                    "tau_response_h": None,
                    "tau_loss_h": None,
                    "heating_curve_steepness": None,
                    "heating_curve_parallel_shift": None,
                })
            else:
                rooms.append({
                    "room_id": room_id,
                    "room_name": room_data.get("name", room_id),
                    "status": "waiting",
                    "data_points": 0,
                    "learned_at": None,
                    "tau_response_h": None,
                    "tau_loss_h": None,
                    "heating_curve_steepness": None,
                    "heating_curve_parallel_shift": None,
                })
    except Exception as e:
        logger.warning("Thermische Raeume laden fehlgeschlagen: %s", e)

    return rooms
