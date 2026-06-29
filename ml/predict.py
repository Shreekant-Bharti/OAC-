import argparse
import json
import pickle
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.features import engineer_features, get_feature_columns

MODEL_FILE = Path("ml/models/model.pkl")

RISK_THRESHOLDS = [(0.85, "High"), (0.60, "Medium"), (0.0, "Low")]
TTI_THRESHOLDS  = [
    (0.90, "5 minutes"),
    (0.80, "12 minutes"),
    (0.65, "20 minutes"),
    (0.50, "35 minutes"),
    (0.0,  "60+ minutes"),
]

SAMPLE_TELEMETRY = {
    "site":             "Branch-2",
    "device":           "WAN-Edge-B2-01",
    "latency_ms":       72.0,
    "packet_loss_pct":  4.0,
    "jitter_ms":        12.0,
    "utilization_pct":  95.0,
    "cpu_pct":          78.0,
    "memory_pct":       72.0,
    "bgp_flaps":        7,
    "ospf_events":      2,
    "tunnel_health":    1,
    "interface_errors": 5,
}


def load_model() -> tuple:
    if not MODEL_FILE.exists():
        print(f"[ERROR] Model not found: {MODEL_FILE}\n  Run: python ml/train.py")
        sys.exit(1)
    with open(MODEL_FILE, "rb") as f:
        payload = pickle.load(f)
    return payload["model"], payload["feature_columns"]


def _build_feature_row(telemetry: dict, feature_cols: list[str]) -> pd.DataFrame:
    """
    Build a 15-row degrading sequence ending at the current telemetry values.
    Rolling and lag features then reflect realistic increasing trends,
    matching the patterns the model was trained on.
    """
    n = 15
    t = np.linspace(0.2, 1.0, n)

    # Baseline (normal) values to interpolate from
    baseline = {
        "latency_ms":       22.0,
        "packet_loss_pct":  0.1,
        "jitter_ms":        2.5,
        "utilization_pct":  52.0,
        "cpu_pct":          28.0,
        "memory_pct":       38.0,
        "bgp_flaps":        0,
        "ospf_events":      0,
        "tunnel_health":    1.0,
        "interface_errors": 0,
    }

    rows = []
    for i in range(n):
        row = {
            "timestamp":   pd.Timestamp.now() - pd.Timedelta(minutes=(n - i - 1) * 5),
            "site":        telemetry.get("site", "unknown"),
            "device":      telemetry.get("device", "unknown"),
            "fault_label": 0,
        }
        for col, base_val in baseline.items():
            current_val = float(telemetry.get(col, base_val))
            row[col] = base_val + t[i] * (current_val - base_val)
        rows.append(row)

    df = pd.DataFrame(rows)
    df = engineer_features(df)
    return df.iloc[[-1]][feature_cols]


def _get_risk(proba: float) -> str:
    for threshold, label in RISK_THRESHOLDS:
        if proba >= threshold:
            return label
    return "Low"


def _get_tti(proba: float) -> str:
    for threshold, tti in TTI_THRESHOLDS:
        if proba >= threshold:
            return tti
    return "60+ minutes"


def _build_reasons(t: dict, proba: float) -> list[str]:
    reasons = []
    if t.get("utilization_pct", 0) > 90:
        reasons.append(f"Link utilization at {t['utilization_pct']}% exceeds critical threshold (90%)")
    if t.get("packet_loss_pct", 0) > 1.0:
        reasons.append(f"Packet loss {t['packet_loss_pct']}% exceeds acceptable limit (1%)")
    if t.get("bgp_flaps", 0) > 3:
        reasons.append(f"BGP flaps: {t['bgp_flaps']} indicate routing instability")
    if t.get("latency_ms", 0) > 50:
        reasons.append(f"Latency {t['latency_ms']} ms exceeds SLA threshold (50 ms)")
    if t.get("jitter_ms", 0) > 10:
        reasons.append(f"Jitter {t['jitter_ms']} ms impacts real-time traffic quality")
    if t.get("interface_errors", 0) > 3:
        reasons.append(f"Interface error count {t['interface_errors']} suggests physical layer issue")
    if t.get("cpu_pct", 0) > 80:
        reasons.append(f"CPU at {t['cpu_pct']}% risks control-plane instability")
    if not reasons:
        reasons.append(f"Model confidence {proba:.0%} exceeded risk threshold based on metric combination")
    return reasons


def predict(telemetry: dict) -> dict:
    model, feature_cols = load_model()
    X = _build_feature_row(telemetry, feature_cols)
    proba = float(model.predict_proba(X)[0][1])

    return {
        "site":            telemetry.get("site", "unknown"),
        "device":          telemetry.get("device", "unknown"),
        "risk":            _get_risk(proba),
        "confidence":      round(proba * 100),
        "time_to_impact":  _get_tti(proba),
        "metrics": {
            "latency":     telemetry.get("latency_ms", 0),
            "packet_loss": telemetry.get("packet_loss_pct", 0),
            "utilization": telemetry.get("utilization_pct", 0),
            "jitter":      telemetry.get("jitter_ms", 0),
            "bgp_flaps":   telemetry.get("bgp_flaps", 0),
        },
        "prediction_reason": _build_reasons(telemetry, proba),
    }


def _parse_args() -> dict:
    parser = argparse.ArgumentParser(description="Generate NOC risk prediction")
    parser.add_argument("--site",    default=None)
    parser.add_argument("--device",  default=None)
    parser.add_argument("--latency", type=float, default=None)
    parser.add_argument("--loss",    type=float, default=None)
    parser.add_argument("--util",    type=float, default=None)
    parser.add_argument("--jitter",  type=float, default=None)
    parser.add_argument("--flaps",   type=int,   default=None)
    parser.add_argument("--cpu",     type=float, default=None)
    args = parser.parse_args()

    telemetry = SAMPLE_TELEMETRY.copy()
    if args.site:    telemetry["site"]            = args.site
    if args.device:  telemetry["device"]          = args.device
    if args.latency: telemetry["latency_ms"]      = args.latency
    if args.loss:    telemetry["packet_loss_pct"] = args.loss
    if args.util:    telemetry["utilization_pct"] = args.util
    if args.jitter:  telemetry["jitter_ms"]       = args.jitter
    if args.flaps:   telemetry["bgp_flaps"]       = args.flaps
    if args.cpu:     telemetry["cpu_pct"]         = args.cpu
    return telemetry


if __name__ == "__main__":
    telemetry = _parse_args()
    result = predict(telemetry)
    print(json.dumps(result, indent=2))
