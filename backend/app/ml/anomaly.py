"""Anomalie-Erkennung für Energiedaten."""

import numpy as np
import pandas as pd


class AnomalyDetector:
    """Erkennt ungewöhnliche Verbrauchs- oder Erzeugungsmuster."""

    def __init__(self, z_threshold: float = 3.0):
        self.z_threshold = z_threshold

    def detect_zscore(self, values: pd.Series) -> pd.Series:
        """Z-Score basierte Anomalie-Erkennung."""
        mean = values.rolling(window=96 * 7, min_periods=96).mean()  # 7-Tage-Fenster
        std = values.rolling(window=96 * 7, min_periods=96).std()
        z_scores = (values - mean) / std.replace(0, np.nan)
        return z_scores.abs() > self.z_threshold

    def detect_iqr(self, values: pd.Series, window: int = 96) -> pd.Series:
        """IQR-basierte Anomalie-Erkennung."""
        q1 = values.rolling(window=window).quantile(0.25)
        q3 = values.rolling(window=window).quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        return (values < lower) | (values > upper)
