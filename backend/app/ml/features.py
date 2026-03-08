"""Feature Engineering für ML-Modelle."""

import numpy as np
import pandas as pd


def create_time_features(df: pd.DataFrame, timestamp_col: str = "timestamp") -> pd.DataFrame:
    """Erstelle Zeitbasierte Features aus einem Timestamp."""
    ts = pd.to_datetime(df[timestamp_col])

    df["hour"] = ts.dt.hour
    df["minute"] = ts.dt.minute
    df["day_of_week"] = ts.dt.dayofweek
    df["month"] = ts.dt.month
    df["is_weekend"] = (ts.dt.dayofweek >= 5).astype(int)

    # Zyklische Kodierung
    df["hour_sin"] = np.sin(2 * np.pi * ts.dt.hour / 24)
    df["hour_cos"] = np.cos(2 * np.pi * ts.dt.hour / 24)
    df["month_sin"] = np.sin(2 * np.pi * ts.dt.month / 12)
    df["month_cos"] = np.cos(2 * np.pi * ts.dt.month / 12)
    df["dow_sin"] = np.sin(2 * np.pi * ts.dt.dayofweek / 7)
    df["dow_cos"] = np.cos(2 * np.pi * ts.dt.dayofweek / 7)

    return df


def create_lag_features(
    df: pd.DataFrame, value_col: str, lags: list[int] | None = None
) -> pd.DataFrame:
    """Erstelle Lag-Features für Zeitreihenprognosen."""
    if lags is None:
        lags = [1, 4, 96, 672]  # 15min, 1h, 1d, 1w (bei 15min Auflösung)

    for lag in lags:
        df[f"{value_col}_lag_{lag}"] = df[value_col].shift(lag)

    # Rolling statistics
    df[f"{value_col}_rolling_mean_96"] = df[value_col].rolling(96).mean()  # 24h
    df[f"{value_col}_rolling_std_96"] = df[value_col].rolling(96).std()

    return df
