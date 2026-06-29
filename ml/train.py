import logging
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score,
    recall_score, roc_auc_score,
)
import xgboost as xgb
import lightgbm as lgb

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.features import engineer_features, get_feature_columns

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

DATA_FILE  = Path("ml/data/network_telemetry.csv")
MODEL_DIR  = Path("ml/models")
MODEL_FILE = MODEL_DIR / "model.pkl"


def load_data(path: Path) -> tuple[pd.DataFrame, pd.DataFrame, list[str]]:
    log.info(f"Loading: {path}")
    df = pd.read_csv(path)
    log.info(f"  Rows: {len(df):,} | Fault rate: {df['fault_label'].mean():.1%}")

    df = engineer_features(df)
    feature_cols = get_feature_columns(df)

    # Time-based split — last 20% is held-out test set
    split = int(len(df) * 0.80)
    return df.iloc[:split], df.iloc[split:], feature_cols


def _class_weight_ratio(y: pd.Series) -> float:
    return float((y == 0).sum() / max((y == 1).sum(), 1))


def train_all(X_train: pd.DataFrame, y_train: pd.Series) -> dict:
    ratio = _class_weight_ratio(y_train)
    models = {}

    log.info("Training Random Forest ...")
    models["RandomForest"] = RandomForestClassifier(
        n_estimators=150, max_depth=14, n_jobs=-1,
        class_weight="balanced", random_state=42,
    ).fit(X_train, y_train)

    log.info("Training XGBoost ...")
    models["XGBoost"] = xgb.XGBClassifier(
        n_estimators=250, max_depth=6, learning_rate=0.05,
        scale_pos_weight=ratio, eval_metric="logloss",
        random_state=42, verbosity=0,
    ).fit(X_train, y_train)

    log.info("Training LightGBM ...")
    models["LightGBM"] = lgb.LGBMClassifier(
        n_estimators=250, max_depth=6, learning_rate=0.05,
        class_weight="balanced", random_state=42, verbose=-1,
    ).fit(X_train, y_train)

    return models


def score(model, X: pd.DataFrame, y: pd.Series, name: str) -> dict:
    y_pred  = model.predict(X)
    y_proba = model.predict_proba(X)[:, 1]
    fpr     = float(((y_pred == 1) & (y == 0)).sum() / max((y == 0).sum(), 1))
    return {
        "model":     name,
        "accuracy":  accuracy_score(y, y_pred),
        "precision": precision_score(y, y_pred, zero_division=0),
        "recall":    recall_score(y, y_pred, zero_division=0),
        "f1":        f1_score(y, y_pred, zero_division=0),
        "roc_auc":   roc_auc_score(y, y_proba),
        "fpr":       fpr,
    }


def print_comparison(results: list[dict]) -> None:
    w = 78
    print("\n" + "=" * w)
    print(f"  {'MODEL COMPARISON':^{w-4}}")
    print("=" * w)
    hdr = f"{'Model':<15} {'Accuracy':>9} {'Precision':>10} {'Recall':>8} {'F1':>8} {'ROC-AUC':>9} {'FPR':>7}"
    print(hdr)
    print("-" * w)
    for r in results:
        print(
            f"{r['model']:<15} {r['accuracy']:>9.4f} {r['precision']:>10.4f} "
            f"{r['recall']:>8.4f} {r['f1']:>8.4f} {r['roc_auc']:>9.4f} {r['fpr']:>7.4f}"
        )
    print("=" * w)


def save_best(model, feature_cols: list[str], name: str) -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"model": model, "model_name": name, "feature_columns": feature_cols}
    with open(MODEL_FILE, "wb") as f:
        pickle.dump(payload, f)
    log.info(f"Saved: {MODEL_FILE}")


def run() -> None:
    train_df, test_df, feature_cols = load_data(DATA_FILE)

    X_train, y_train = train_df[feature_cols], train_df["fault_label"]
    X_test,  y_test  = test_df[feature_cols],  test_df["fault_label"]

    models = train_all(X_train, y_train)

    results = [score(model, X_test, y_test, name) for name, model in models.items()]
    print_comparison(results)

    best = max(results, key=lambda r: r["f1"])
    best_name  = best["model"]
    best_model = models[best_name]

    print(f"\n  Best model : {best_name}")
    print(f"  F1 Score   : {best['f1']:.4f}")
    print(f"  ROC AUC    : {best['roc_auc']:.4f}\n")

    save_best(best_model, feature_cols, best_name)


if __name__ == "__main__":
    run()
