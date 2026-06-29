import json
import warnings
import numpy as np
import joblib
from pathlib import Path
from collections import Counter

warnings.filterwarnings("ignore", category=UserWarning)

model_dir = Path("ml/models")
clf = joblib.load(model_dir / "classifier.joblib")
le  = joblib.load(model_dir / "label_encoder.joblib")

with open(model_dir / "meta.json") as f:
    meta = json.load(f)
feature_cols = meta["feature_cols"]

# ------------------------------------------------------------------
# Generate a synthetic held-out test set that matches training dist
# ------------------------------------------------------------------
rng = np.random.default_rng(seed=99)
n_per_class = 400
class_names = le.classes_.tolist()  # ['Critical','Failure','High Risk','Normal','Warning']

def _make_samples(class_name, n):
    """Generate n telemetry feature rows for a given ground-truth class."""
    if class_name == "Normal":
        return np.column_stack([
            rng.uniform(20, 65, n),   # utilization_pct
            rng.uniform(0, 0.5, n),   # packet_loss_pct
            rng.uniform(10, 40, n),   # latency_ms
            rng.uniform(1, 6, n),     # jitter_ms
            rng.uniform(10, 100, n),  # queue_length
            rng.uniform(50, 200, n),  # active_flows
            rng.uniform(0.9, 1.0, n), # tunnel_uptime
            rng.uniform(100, 400, n), # throughput_mbps
            rng.uniform(1e5, 5e6, n), # rx_bytes
            rng.uniform(1e5, 5e6, n), # tx_bytes
            np.zeros(n),              # failure_category_enc
        ])
    elif class_name == "Warning":
        return np.column_stack([
            rng.uniform(70, 85, n),
            rng.uniform(1.0, 2.5, n),
            rng.uniform(55, 80, n),
            rng.uniform(10, 20, n),
            rng.uniform(140, 220, n),
            rng.uniform(370, 430, n),
            rng.uniform(0.65, 0.85, n),
            rng.uniform(350, 550, n),
            rng.uniform(4e6, 8e6, n),
            rng.uniform(4e6, 8e6, n),
            np.zeros(n),
        ])
    elif class_name == "High Risk":
        return np.column_stack([
            rng.uniform(83, 93, n),
            rng.uniform(2.5, 5.0, n),
            rng.uniform(78, 110, n),
            rng.uniform(18, 32, n),
            rng.uniform(200, 320, n),
            rng.uniform(430, 490, n),
            rng.uniform(0.45, 0.68, n),
            rng.uniform(500, 700, n),
            rng.uniform(7e6, 1.2e7, n),
            rng.uniform(7e6, 1.2e7, n),
            rng.integers(0, 2, n).astype(float),
        ])
    elif class_name == "Critical":
        return np.column_stack([
            rng.uniform(90, 98, n),
            rng.uniform(4.5, 8.0, n),
            rng.uniform(105, 140, n),
            rng.uniform(28, 40, n),
            rng.uniform(300, 450, n),
            rng.uniform(470, 510, n),
            rng.uniform(0.2, 0.48, n),
            rng.uniform(650, 900, n),
            rng.uniform(1e7, 2e7, n),
            rng.uniform(1e7, 2e7, n),
            rng.integers(1, 3, n).astype(float),
        ])
    else:  # Failure
        return np.column_stack([
            rng.uniform(93, 100, n),
            rng.uniform(6.5, 12.0, n),
            rng.uniform(130, 180, n),
            rng.uniform(35, 55, n),
            rng.uniform(380, 500, n),
            rng.uniform(490, 520, n),
            rng.uniform(0.0, 0.22, n),
            rng.uniform(800, 1000, n),
            rng.uniform(1.5e7, 3e7, n),
            rng.uniform(1.5e7, 3e7, n),
            np.full(n, 3.0),
        ])

X_parts, y_parts = [], []
for class_idx, class_name in enumerate(class_names):
    X_parts.append(_make_samples(class_name, n_per_class))
    y_parts.append(np.full(n_per_class, class_idx, dtype=int))

X_test = np.vstack(X_parts)
y_true = np.concatenate(y_parts)

y_pred_idx = clf.predict(X_test)
y_proba    = clf.predict_proba(X_test)

# ------------------------------------------------------------------
# Confusion Matrix
# ------------------------------------------------------------------
n_classes = len(class_names)
cm = np.zeros((n_classes, n_classes), dtype=int)
for t, p in zip(y_true, y_pred_idx):
    cm[t][p] += 1

print("=" * 70)
print("  CONFUSION MATRIX  (rows=True, cols=Predicted)")
print("=" * 70)
header = f"{'':>12}" + "".join(f"  {c[:9]:>9}" for c in class_names)
print(header)
print("-" * 70)
for i, row_name in enumerate(class_names):
    row_str = f"{row_name:>12}" + "".join(f"  {cm[i][j]:>9,}" for j in range(n_classes))
    print(row_str)

# ------------------------------------------------------------------
# Per-class metrics
# ------------------------------------------------------------------
print()
print("=" * 70)
print("  CLASSIFICATION REPORT")
print("=" * 70)
print(f"  {'Class':<14} {'Precision':>10} {'Recall':>8} {'F1':>8} {'Support':>9}")
print(f"  {'-'*14} {'-'*10} {'-'*8} {'-'*8} {'-'*9}")

all_prec, all_rec, all_f1 = [], [], []
for i, name in enumerate(class_names):
    tp = cm[i][i]
    fp = cm[:, i].sum() - tp
    fn = cm[i, :].sum() - tp
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    rec  = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1   = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
    sup  = cm[i, :].sum()
    all_prec.append(prec); all_rec.append(rec); all_f1.append(f1)
    print(f"  {name:<14} {prec:>10.4f} {rec:>8.4f} {f1:>8.4f} {sup:>9,}")

print(f"  {'-'*14} {'-'*10} {'-'*8} {'-'*8} {'-'*9}")
acc = np.trace(cm) / cm.sum()
mac_p = np.mean(all_prec); mac_r = np.mean(all_rec); mac_f1 = np.mean(all_f1)
print(f"  {'Macro avg':<14} {mac_p:>10.4f} {mac_r:>8.4f} {mac_f1:>8.4f} {cm.sum():>9,}")
print(f"  {'Accuracy':<14} {'':>10} {'':>8} {acc:>8.4f} {cm.sum():>9,}")

# ------------------------------------------------------------------
# ROC-AUC (one-vs-rest)
# ------------------------------------------------------------------
print()
print("=" * 70)
print("  ROC-AUC (One-vs-Rest per class)")
print("=" * 70)
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import label_binarize

y_bin = label_binarize(y_true, classes=list(range(n_classes)))
for i, name in enumerate(class_names):
    try:
        auc = roc_auc_score(y_bin[:, i], y_proba[:, i])
        print(f"  {name:<14}: ROC-AUC = {auc:.4f}")
    except Exception as e:
        print(f"  {name:<14}: ROC-AUC = N/A ({e})")

try:
    macro_auc = roc_auc_score(y_bin, y_proba, average="macro", multi_class="ovr")
    print(f"  {'Macro avg':<14}: ROC-AUC = {macro_auc:.4f}")
except Exception as e:
    print(f"  Macro ROC-AUC: N/A ({e})")

# ------------------------------------------------------------------
# Confidence distribution
# ------------------------------------------------------------------
max_proba = y_proba.max(axis=1)
print()
print("=" * 70)
print("  CONFIDENCE DISTRIBUTION")
print("=" * 70)
bins = [(0, 60), (60, 70), (70, 80), (80, 90), (90, 95), (95, 99), (99, 100.01)]
for lo, hi in bins:
    mask = (max_proba * 100 >= lo) & (max_proba * 100 < hi)
    pct = mask.sum() / len(max_proba) * 100
    bar = "#" * int(pct / 2)
    print(f"  [{lo:>3}-{min(hi,100):>3}%]: {mask.sum():>5} samples ({pct:>5.1f}%)  {bar}")

print()
print("  Mean confidence :  {:.1f}%".format(max_proba.mean() * 100))
print("  Std deviation   :  {:.1f}%".format(max_proba.std() * 100))
print("  Min confidence  :  {:.1f}%".format(max_proba.min() * 100))
print("  Max confidence  :  {:.1f}%".format(max_proba.max() * 100))

# ------------------------------------------------------------------
# Reliability check (calibration)
# ------------------------------------------------------------------
print()
print("=" * 70)
print("  RELIABILITY (Calibration) CHECK")
print("=" * 70)
bin_edges = np.linspace(0, 1, 11)
print(f"  {'Conf bin':<14} {'Pred accuracy':>15} {'Avg confidence':>16} {'Samples':>9}")
print(f"  {'-'*14} {'-'*15} {'-'*16} {'-'*9}")
for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
    mask = (max_proba >= lo) & (max_proba < hi)
    if mask.sum() == 0:
        continue
    correct = (y_pred_idx[mask] == y_true[mask]).mean()
    avg_conf = max_proba[mask].mean()
    n = mask.sum()
    diff = avg_conf - correct
    flag = " <-- OVERCONFIDENT" if diff > 0.05 else (" <-- UNDERCONFIDENT" if diff < -0.05 else "")
    print(f"  [{lo:.1f}-{hi:.1f}]      {correct:>15.4f} {avg_conf:>16.4f} {n:>9}{flag}")

print()
print("EVALUATION COMPLETE")
