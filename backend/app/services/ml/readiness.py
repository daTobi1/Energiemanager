"""
Readiness-Berechnung — Bewertet ob ein ML-Modell bereit fuer den Aktivmodus ist.

4 Kriterien (gewichtet):
- Datenmenge (25%): Wie viele Trainingsdaten vorhanden sind
- Genauigkeit (35%): R2-Score des Modells
- Fehler (25%): MAE relativ zum modellspezifischen Schwellwert
- Aktualitaet (15%): Wie aktuell das letzte Training ist
"""

from datetime import datetime, timezone

# MAE-Schwellwerte pro Modelltyp (in kW)
MAE_THRESHOLDS = {
    "pv_correction": 1.0,
    "load_correction": 0.8,
    "thermal_correction": 0.5,
}

# R2-Schwellwerte pro Level
R2_THRESHOLDS = {
    "pv_correction": {"min": 0.2, "good": 0.6, "excellent": 0.8},
    "load_correction": {"min": 0.2, "good": 0.5, "excellent": 0.75},
    "thermal_correction": {"min": 0.15, "good": 0.5, "excellent": 0.7},
}


def calculate_readiness(
    forecast_type: str,
    training_samples: int,
    r2_score: float,
    mae: float,
    trained_at: datetime | None,
) -> dict:
    """
    Berechnet Readiness-Score und -Level fuer ein ML-Modell.

    Returns:
        {
            score: float (0-1),
            level: "not_ready" | "learning" | "ready" | "excellent",
            criteria: { data: float, accuracy: float, error: float, freshness: float },
            can_activate: bool,
            recommendation: str,
        }
    """
    # 1. Datenmenge (25%)
    if training_samples >= 2160:
        data_score = 1.0
    elif training_samples >= 720:
        data_score = 0.8 + 0.2 * (training_samples - 720) / 1440
    elif training_samples >= 168:
        data_score = 0.5 + 0.3 * (training_samples - 168) / 552
    else:
        data_score = 0.5 * training_samples / 168 if training_samples > 0 else 0.0

    # 2. Genauigkeit (35%) — R2 linear interpoliert
    thresholds = R2_THRESHOLDS.get(forecast_type, R2_THRESHOLDS["pv_correction"])
    if r2_score >= thresholds["excellent"]:
        accuracy_score = 1.0
    elif r2_score >= thresholds["good"]:
        accuracy_score = 0.7 + 0.3 * (r2_score - thresholds["good"]) / (thresholds["excellent"] - thresholds["good"])
    elif r2_score >= thresholds["min"]:
        accuracy_score = 0.3 + 0.4 * (r2_score - thresholds["min"]) / (thresholds["good"] - thresholds["min"])
    elif r2_score > 0:
        accuracy_score = 0.3 * r2_score / thresholds["min"]
    else:
        accuracy_score = 0.0

    # 3. Fehler (25%) — MAE relativ zum Schwellwert
    mae_threshold = MAE_THRESHOLDS.get(forecast_type, 1.0)
    if mae <= 0:
        error_score = 1.0
    elif mae <= mae_threshold * 0.3:
        error_score = 1.0
    elif mae <= mae_threshold * 0.6:
        error_score = 0.7 + 0.3 * (1 - (mae - mae_threshold * 0.3) / (mae_threshold * 0.3))
    elif mae <= mae_threshold:
        error_score = 0.3 + 0.4 * (1 - (mae - mae_threshold * 0.6) / (mae_threshold * 0.4))
    else:
        error_score = max(0.0, 0.3 * (1 - (mae - mae_threshold) / mae_threshold))

    # 4. Aktualitaet (15%)
    if trained_at is None:
        freshness_score = 0.0
    else:
        now = datetime.now(timezone.utc)
        if trained_at.tzinfo is None:
            trained_at = trained_at.replace(tzinfo=timezone.utc)
        hours_ago = (now - trained_at).total_seconds() / 3600
        if hours_ago < 24:
            freshness_score = 1.0
        elif hours_ago < 72:
            freshness_score = 0.8
        elif hours_ago < 168:
            freshness_score = 0.5
        else:
            freshness_score = 0.2

    # Gewichteter Score
    score = round(
        0.25 * data_score
        + 0.35 * accuracy_score
        + 0.25 * error_score
        + 0.15 * freshness_score,
        3,
    )

    # Can activate?
    can_activate = score >= 0.5 and r2_score >= 0.3 and training_samples >= 168

    # Level
    if score >= 0.8:
        level = "excellent"
    elif score >= 0.5:
        level = "ready"
    elif score >= 0.2:
        level = "learning"
    else:
        level = "not_ready"

    # Empfehlung
    recommendation = _build_recommendation(
        level, can_activate, training_samples, r2_score, mae, mae_threshold, freshness_score,
    )

    return {
        "score": score,
        "level": level,
        "criteria": {
            "data": round(data_score, 2),
            "accuracy": round(accuracy_score, 2),
            "error": round(error_score, 2),
            "freshness": round(freshness_score, 2),
        },
        "can_activate": can_activate,
        "recommendation": recommendation,
    }


def _build_recommendation(
    level: str,
    can_activate: bool,
    samples: int,
    r2: float,
    mae: float,
    mae_threshold: float,
    freshness: float,
) -> str:
    """Erzeugt eine deutschsprachige Empfehlung."""
    if level == "excellent":
        return "Modell arbeitet ausgezeichnet. Aktivierung empfohlen."
    if level == "ready" and can_activate:
        return "Modell ist bereit fuer die Aktivierung."
    if level == "ready" and not can_activate:
        if r2 < 0.3:
            return f"R2-Score ({r2:.2f}) noch zu niedrig fuer Aktivierung. Mehr Daten sammeln."
        if samples < 168:
            return f"Noch {168 - samples} Datenpunkte bis zur Mindestmenge."
        return "Score knapp unter Schwelle. Mehr Daten verbessern die Genauigkeit."
    if level == "learning":
        parts = []
        if samples < 168:
            parts.append(f"Noch {168 - samples} Datenpunkte noetig")
        if r2 < 0.3:
            parts.append(f"R2-Score ({r2:.2f}) muss ueber 0.30 steigen")
        if freshness < 0.5:
            parts.append("Training veraltet — Neutraining empfohlen")
        return ". ".join(parts) + "." if parts else "Modell lernt noch. Geduld."
    # not_ready
    if samples == 0:
        return "Noch kein Training durchgefuehrt. Simulator starten oder auf Messdaten warten."
    return f"Zu wenig Daten ({samples} Samples). Mindestens 168 benoetigt (7 Tage stuendlich)."
