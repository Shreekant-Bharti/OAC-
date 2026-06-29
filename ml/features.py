import numpy as np
import pandas as pd

NUMERIC_COLS = [
    "latency_ms", "packet_loss_pct", "jitter_ms", "utilization_pct",
    "cpu_pct", "memory_pct", "bgp_flaps", "ospf_events",
    "tunnel_health", "interface_errors",
]

ROLLING_WINDOWS = [3, 6, 12]   # 15 min, 30 min, 60 min at 5-min intervals
LAG_COLS = ["latency_ms", "packet_loss_pct", "utilization_pct", "bgp_flaps"]
LAGS = [1, 2, 3]
DELTA_COLS = ["latency_ms", "packet_loss_pct", "utilization_pct"]
DROP_COLS = {"timestamp", "site", "device", "fault_label"}


def _rolling(df: pd.DataFrame) -> pd.DataFrame:
    for col in NUMERIC_COLS:
        grouped = df.groupby(["site", "device"])[col]
        for w in ROLLING_WINDOWS:
            df[f"{col}_rmean{w}"] = grouped.transform(
                lambda x, w=w: x.rolling(w, min_periods=1).mean()
            )
            df[f"{col}_rstd{w}"] = grouped.transform(
                lambda x, w=w: x.rolling(w, min_periods=1).std().fillna(0)
            )
    return df


def _lags(df: pd.DataFrame) -> pd.DataFrame:
    for col in LAG_COLS:
        grouped = df.groupby(["site", "device"])[col]
        for lag in LAGS:
            df[f"{col}_lag{lag}"] = grouped.shift(lag).fillna(0)
    return df


def _deltas(df: pd.DataFrame) -> pd.DataFrame:
    for col in DELTA_COLS:
        df[f"{col}_delta"] = df.groupby(["site", "device"])[col].diff().fillna(0)
    return df


def _time_features(df: pd.DataFrame) -> pd.DataFrame:
    ts = pd.to_datetime(df["timestamp"])
    df["hour"] = ts.dt.hour
    df["day_of_week"] = ts.dt.dayofweek
    df["is_business_hours"] = ((ts.dt.hour >= 9) & (ts.dt.hour <= 18)).astype(int)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = _rolling(df)
    df = _lags(df)
    df = _deltas(df)
    df = _time_features(df)
    return df


def get_feature_columns(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns if c not in DROP_COLS]
