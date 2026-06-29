import pandas as pd
import numpy as np
import json
import warnings
import joblib
from pathlib import Path
from sklearn.metrics import (
    confusion_matrix, classification_report,
    roc_auc_score,
)
from sklearn.preprocessing import label_binarize

warnings.filterwarnings("ignore", category=UserWarning)

# Load data
df = pd.read_csv("ml/data/noc_dataset.csv")
cat_enc = joblib.load("ml/models/category_encoder.joblib")
df["failure_category_enc"] = cat_enc.transform(df["failure_category"])

with open("ml/models/meta.json") as f:
    meta = json.load(f)
feature_cols = meta["feature_cols"]

test_split = int(len(df) * 0.80)
test_df = df.iloc[test_split:].reset_index(drop=True)

clf = joblib.load("ml/models/classifier.joblib")
le  = joblib.load("ml/models/label_encoder.joblib")

X_test = test_df[feature_cols].values
y_true_idx = le.transform(test_df["network_condition"])
y_pred_idx = clf.predict(X_test)
y_proba    = clf.predict_proba(X_test)
max_p      = y_proba.max(axis=1)

class_names = le.classes_.tolist()
n_classes = len(class_names)

print("=" * 70)
print("  CONFUSION MATRIX  (rows=True, cols=Predicted)")
print("=" * 70)
cm = confusion_matrix(y_true_idx, y_pred_idx)
header = f"{'':>14}" + "".join(f"  {c[:9]:>9}" for c in class_names)
print(header)
print("-" * 70)
for i, row_name in enumerate(class_names):
    row_str = f"{row_name:>14}" + "".join(f"  {cm[i][j]:>9,}" for j in range(n_classes))
    print(row_str)

print()
print("=" * 70)
print("  CLASSIFICATION REPORT")
print("=" * 70)
print(classification_report(y_true_idx, y_pred_idx, target_names=class_names, digits=4))

print("=" * 70)
print("  ROC-AUC (One-vs-Rest per class)")
print("=" * 70)
y_bin = label_binarize(y_true_idx, classes=list(range(n_classes)))
for i, name in enumerate(class_names):
    try:
        auc = roc_auc_score(y_bin[:, i], y_proba[:, i])
        print(f"  {name:<14}: {auc:.4f}")
    except Exception as e:
        print(f"  {name:<14}: N/A ({e})")
try:
    macro_auc = roc_auc_score(y_bin, y_proba, average="macro", multi_class="ovr")
    print(f"  {'Macro avg':<14}: {macro_auc:.4f}")
except Exception as e:
    print(f"  Macro: N/A ({e})")

print()
print("=" * 70)
print("  CONFIDENCE DISTRIBUTION")
print("=" * 70)
bins = [(0, 60), (60, 70), (70, 80), (80, 90), (90, 95), (95, 99), (99, 100.01)]
for lo, hi in bins:
    mask = (max_p * 100 >= lo) & (max_p * 100 < hi)
    pct = mask.sum() / len(max_p) * 100
    bar = "#" * int(pct / 2)
    print(f"  [{lo:>3}-{min(hi, 100):>3}%]: {mask.sum():>6} samples ({pct:>5.1f}%)  {bar}")

print(f"\n  Mean: {max_p.mean()*100:.1f}%  "
      f"Std: {max_p.std()*100:.2f}%  "
      f"Min: {max_p.min()*100:.1f}%  "
      f"Max: {max_p.max()*100:.1f}%")

print()
print("=" * 70)
print("  RELIABILITY CHECK (Calibration)")
print("=" * 70)
bin_edges = np.linspace(0, 1, 11)
print(f"  {'Conf bin':<12} {'Accuracy':>10} {'Avg conf':>10} {'Samples':>9}")
print(f"  {'-'*12} {'-'*10} {'-'*10} {'-'*9}")
for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
    mask = (max_p >= lo) & (max_p < hi)
    if mask.sum() == 0:
        continue
    correct = (y_pred_idx[mask] == y_true_idx[mask]).mean()
    avg_conf = max_p[mask].mean()
    diff = avg_conf - correct
    flag = " <-- OVERCONFIDENT" if diff > 0.05 else (" <-- UNDERCONFIDENT" if diff < -0.05 else " OK")
    print(f"  [{lo:.1f}-{hi:.1f}]      {correct:>10.4f} {avg_conf:>10.4f} {mask.sum():>9}{flag}")

print()
print("EVALUATION COMPLETE")
