import json
import warnings
import numpy as np
import joblib
from pathlib import Path

warnings.filterwarnings("ignore", category=UserWarning)

model_dir = Path("ml/models")
clf = joblib.load(model_dir / "classifier.joblib")
le  = joblib.load(model_dir / "label_encoder.joblib")
reg = joblib.load(model_dir / "regressor.joblib")
sc  = joblib.load(model_dir / "scaler.joblib")

with open(model_dir / "meta.json") as f:
    meta = json.load(f)
feature_cols = meta["feature_cols"]

# Multi-scenario confidence audit
scenarios = [
    {"name": "Normal",    "utilization_pct": 40, "packet_loss_pct": 0.05, "latency_ms": 18,  "jitter_ms": 2,  "queue_length": 20,  "active_flows": 100, "tunnel_uptime": 1.0, "throughput_mbps": 200, "rx_bytes": 1e6,  "tx_bytes": 1e6,  "failure_category_enc": 0},
    {"name": "Warning",   "utilization_pct": 78, "packet_loss_pct": 1.5,  "latency_ms": 65,  "jitter_ms": 12, "queue_length": 160, "active_flows": 390, "tunnel_uptime": 0.8, "throughput_mbps": 400, "rx_bytes": 5e6,  "tx_bytes": 5e6,  "failure_category_enc": 0},
    {"name": "High Risk", "utilization_pct": 88, "packet_loss_pct": 3.5,  "latency_ms": 90,  "jitter_ms": 25, "queue_length": 250, "active_flows": 450, "tunnel_uptime": 0.6, "throughput_mbps": 600, "rx_bytes": 8e6,  "tx_bytes": 8e6,  "failure_category_enc": 1},
    {"name": "Critical",  "utilization_pct": 96, "packet_loss_pct": 6.0,  "latency_ms": 120, "jitter_ms": 35, "queue_length": 400, "active_flows": 500, "tunnel_uptime": 0.3, "throughput_mbps": 800, "rx_bytes": 1e7,  "tx_bytes": 1e7,  "failure_category_enc": 2},
    {"name": "Borderline","utilization_pct": 73, "packet_loss_pct": 0.9,  "latency_ms": 58,  "jitter_ms": 9,  "queue_length": 140, "active_flows": 370, "tunnel_uptime": 0.6, "throughput_mbps": 350, "rx_bytes": 4e6,  "tx_bytes": 4e6,  "failure_category_enc": 0},
]

print("=" * 80)
print("  CONFIDENCE DISTRIBUTION AUDIT")
print("=" * 80)
print(f"{'Input Scenario':<14} {'Predicted':<12} {'confidence_score':>16}  {'confidence(int)':>16}  Distribution")
print("-" * 80)
for s in scenarios:
    X = np.array([[s[f] for f in feature_cols]])
    proba = clf.predict_proba(X)[0]
    label_idx = int(clf.predict(X)[0])
    label = le.inverse_transform([label_idx])[0]
    max_p = float(np.max(proba))
    conf_float = round(max_p * 100, 1)
    conf_int = int(round(max_p * 100))
    dist = "  ".join([f"{le.classes_[i]}:{p*100:.1f}%" for i, p in enumerate(proba) if p > 0.001])
    print(f"{s['name']:<14} {label:<12} {conf_float:>16.1f}  {conf_int:>16}  [{dist}]")

print()
print("=" * 80)
print("  FEATURE IMPORTANCES (XGBoost classifier)")
print("=" * 80)
if hasattr(clf, "feature_importances_"):
    imps = clf.feature_importances_
    sorted_idx = np.argsort(imps)[::-1]
    for rank, i in enumerate(sorted_idx, 1):
        bar = "#" * int(imps[i] * 50)
        print(f"  {rank:2}. {feature_cols[i]:<28} {imps[i]:.4f}  {bar}")

print()
print("=" * 80)
print("  REGRESSOR SMOKE TEST (TTI minutes)")
print("=" * 80)
for s in scenarios:
    X = np.array([[s[f] for f in feature_cols]])
    tti = float(reg.predict(X)[0])
    print(f"  {s['name']:<14}: TTI = {tti:.1f} min")

print()
print("AUDIT COMPLETE")
