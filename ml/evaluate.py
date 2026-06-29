import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    f1_score, precision_score, recall_score, roc_auc_score,
)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.features import engineer_features, get_feature_columns

DATA_FILE  = Path("ml/data/network_telemetry.csv")
MODEL_FILE = Path("ml/models/model.pkl")
INTERVAL_MIN = 5


def load_model() -> tuple:
    if not MODEL_FILE.exists():
        print(f"[ERROR] {MODEL_FILE} not found. Run ml/train.py first.")
        sys.exit(1)
    with open(MODEL_FILE, "rb") as f:
        payload = pickle.load(f)
    return payload["model"], payload["feature_columns"], payload.get("model_name", "Unknown")


def compute_lead_time(df: pd.DataFrame, y_pred: np.ndarray) -> float:
    """
    Average minutes of advance warning before each fault episode starts.
    Measures how early the model detects impending failure.
    """
    lead_times = []
    pred_series = pd.Series(y_pred, index=df.index)

    for (site, device), group in df.groupby(["site", "device"]):
        actual    = group["fault_label"].values
        predicted = pred_series.loc[group.index].values

        for i in range(1, len(actual)):
            if actual[i] == 1 and actual[i - 1] == 0:
                for j in range(max(0, i - 24), i):
                    if predicted[j] == 1:
                        lead_times.append((i - j) * INTERVAL_MIN)
                        break

    return float(np.mean(lead_times)) if lead_times else 0.0


def run() -> None:
    model, feature_cols, model_name = load_model()

    df = pd.read_csv(DATA_FILE)
    df = engineer_features(df)

    split   = int(len(df) * 0.80)
    test_df = df.iloc[split:].reset_index(drop=True)

    X_test = test_df[feature_cols]
    y_test = test_df["fault_label"]

    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    fpr       = float(((y_pred == 1) & (y_test == 0)).sum() / max((y_test == 0).sum(), 1))
    lead_time = compute_lead_time(test_df, y_pred)

    w = 55
    print("\n" + "=" * w)
    print(f"  EVALUATION REPORT — {model_name}")
    print("=" * w)
    print(f"  Accuracy           : {accuracy_score(y_test, y_pred):.4f}")
    print(f"  Precision          : {precision_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  Recall             : {recall_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  F1 Score           : {f1_score(y_test, y_pred, zero_division=0):.4f}")
    print(f"  ROC AUC            : {roc_auc_score(y_test, y_proba):.4f}")
    print(f"  False Positive Rate: {fpr:.4f}")
    print(f"  Prediction Lead    : {lead_time:.1f} minutes avg")

    cm = confusion_matrix(y_test, y_pred)
    print(f"\n  Confusion Matrix:")
    print(f"    TN={cm[0,0]:>6,}  FP={cm[0,1]:>6,}")
    print(f"    FN={cm[1,0]:>6,}  TP={cm[1,1]:>6,}")

    print(f"\n{classification_report(y_test, y_pred, target_names=['Normal','At-Risk'])}")
    print("=" * w)


if __name__ == "__main__":
    run()
