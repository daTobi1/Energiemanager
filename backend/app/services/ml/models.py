"""
Modell-Factory — Konfigurierte ML-Modelle fuer Raspberry Pi.

Alle Modelle sind bewusst klein gehalten:
- max_depth=5, n_estimators=100 → ~50-200 KB pro Modell
- n_jobs=1 → kein Multiprocessing auf dem Pi
- learning_rate=0.1 → schnelle Konvergenz bei wenig Daten
"""

from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor


def create_model(model_type: str = "xgboost"):
    """Erzeugt ein konfiguriertes ML-Modell."""
    if model_type == "random_forest":
        return RandomForestRegressor(
            n_estimators=80,
            max_depth=6,
            min_samples_leaf=5,
            n_jobs=1,
            random_state=42,
        )

    # Default: GradientBoosting (sklearn, kein echtes XGBoost noetig)
    return GradientBoostingRegressor(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        min_samples_leaf=5,
        subsample=0.8,
        random_state=42,
    )


def create_quantile_models() -> tuple:
    """Erzeugt Quantil-Modelle fuer Konfidenzintervalle (10., 90. Perzentil)."""
    lower = GradientBoostingRegressor(
        n_estimators=50,
        max_depth=4,
        learning_rate=0.1,
        loss="quantile",
        alpha=0.1,
        random_state=42,
    )
    upper = GradientBoostingRegressor(
        n_estimators=50,
        max_depth=4,
        learning_rate=0.1,
        loss="quantile",
        alpha=0.9,
        random_state=42,
    )
    return lower, upper
