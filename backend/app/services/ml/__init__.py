"""
ML-Prognose-Service — Hybride Vorhersage (Physik-Baseline + ML-Korrektur).

Architektur:
- features.py:  Feature-Engineering aus Messdaten + Wetter
- models.py:    Modell-Factory (XGBoost, RandomForest)
- trainer.py:   Training-Pipeline (Daten, Train, Evaluate, Save)
- predictor.py: Inferenz (Modell laden + Korrektur berechnen)
"""

from app.services.ml.predictor import ml_predictor
from app.services.ml.trainer import ml_trainer

__all__ = ["ml_predictor", "ml_trainer"]
