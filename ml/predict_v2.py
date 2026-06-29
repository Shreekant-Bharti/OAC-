import json
import logging
import time
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np

# Suppress cosmetic UserWarning emitted by pickle when loading a model built
# with a different XGBoost version. Predictions are not affected.
warnings.filterwarnings("ignore", category=UserWarning, module="xgboost")

from ml.feature_mapper import build_feature_vector, load_feature_cols

log = logging.getLogger(__name__)

_MODEL_DIR = Path(__file__).parent / "models"
_ENGINE_NAME = "Engine B (XGBoost + RF Regressor)"
_MODEL_VERSION = "1.1.0"

# ── Risk mapping ───────────────────────────────────────────────────────────────

_CONDITION_TO_RISK: dict[str, str] = {
    "Normal":    "Low",
    "Warning":   "Medium",
    "High Risk": "High",
    "Critical":  "Critical",
    "Failure":   "Critical",
}

# ── Explainability rules ───────────────────────────────────────────────────────
# Calibrated to the actual noc_dataset.csv feature ranges (Task 3, Task 6).
# Each entry: (feature, threshold, message_template, operator)
#   operator ">=" triggers when val >= threshold
#   operator "<"  triggers when val <  threshold
#
# Thresholds derived from training data percentiles and SLA definitions:
#   latency_ms    : P50≈14 ms, warning>30 ms, critical>60 ms, failure>100 ms
#   packet_loss   : P50≈0.25%, warning>1%, critical>5%, failure>10%
#   utilization   : P75≈43%, warning>70%, critical>85%, failure>95%
#   jitter_ms     : P75≈9 ms, warning>15 ms, critical>30 ms
#   queue_length  : P75≈107 pk, warning>150, critical>250
#   active_flows  : P75≈226, warning>350, critical>430
#   tunnel_uptime : warning<0.8, critical<0.5, failure=0
#   throughput    : high-throughput warning>1200 Mbps
#   rx/tx_bytes   : high-volume warning>80M bytes

_REASON_RULES: list[tuple[str, float, str, str]] = [
    # Latency
    ("latency_ms",       30.0,  "Latency at {val} ms exceeds SLA warning threshold (30 ms)",       ">="),
    ("latency_ms",       60.0,  "Latency critical — {val} ms exceeds SLA critical limit (60 ms)",   ">="),
    ("latency_ms",      100.0,  "Latency at {val} ms indicates imminent link failure (limit: 100 ms)", ">="),
    # Packet loss
    ("packet_loss_pct",   1.0,  "Packet loss at {val}% exceeds acceptable threshold (<1%)",         ">="),
    ("packet_loss_pct",   5.0,  "Severe packet loss — {val}% indicates critical degradation (>5%)", ">="),
    ("packet_loss_pct",  10.0,  "Catastrophic packet loss — {val}% (failure threshold: >10%)",       ">="),
    # Utilization
    ("utilization_pct",  70.0,  "Link utilization at {val}% approaching saturation (warning: >70%)", ">="),
    ("utilization_pct",  85.0,  "High utilization — {val}% risks queuing and congestion (critical: >85%)", ">="),
    ("utilization_pct",  95.0,  "Link saturation — {val}% utilization (failure threshold: >95%)",    ">="),
    # Jitter
    ("jitter_ms",        15.0,  "Jitter elevated — {val} ms impacts voice/video quality (SLA: 15 ms)", ">="),
    ("jitter_ms",        30.0,  "Severe jitter — {val} ms indicates physical-layer instability (critical: >30 ms)", ">="),
    # Queue length
    ("queue_length",    150.0,  "Queue buildup — {val} packets (congestion threshold: 150)",          ">="),
    ("queue_length",    250.0,  "Severe queue congestion — {val} packets (critical threshold: 250)",  ">="),
    # Active flows
    ("active_flows",    350.0,  "Elevated flow count — {val} active flows (congestion warning: 350)", ">="),
    ("active_flows",    430.0,  "Flow table near capacity — {val} active flows (critical: >430)",     ">="),
    # Tunnel uptime (lower is worse)
    ("tunnel_uptime",     0.8,  "Tunnel instability — uptime ratio {val} below acceptable (minimum: 0.8)", "<"),
    ("tunnel_uptime",     0.5,  "Tunnel critically degraded — uptime ratio {val} (critical: <0.5)",   "<"),
    ("tunnel_uptime",     0.01, "Tunnel down — uptime ratio {val} (complete failure)",                "<"),
    # Throughput
    ("throughput_mbps", 1200.0, "High throughput — {val} Mbps may indicate traffic anomaly (threshold: 1200 Mbps)", ">="),
]

# ── Input validation bounds (Task 8) ──────────────────────────────────────────
# Tuple: (field, min_val, max_val, description)
# None means no bound in that direction.
_VALIDATION_BOUNDS: list[tuple[str, float | None, float | None, str]] = [
    ("latency_ms",       0.0,   None,   "Latency cannot be negative"),
    ("packet_loss_pct",  0.0,   100.0,  "Packet loss must be 0–100%"),
    ("utilization_pct",  0.0,   100.0,  "Utilization must be 0–100%"),
    ("jitter_ms",        0.0,   None,   "Jitter cannot be negative"),
    ("queue_length",     0.0,   None,   "Queue length cannot be negative"),
    ("active_flows",     0.0,   None,   "Active flows cannot be negative"),
    ("tunnel_uptime",    0.0,   1.0,    "Tunnel uptime must be 0.0–1.0"),
    ("throughput_mbps",  0.0,   None,   "Throughput cannot be negative"),
    ("rx_bytes",         0.0,   None,   "RX bytes cannot be negative"),
    ("tx_bytes",         0.0,   None,   "TX bytes cannot be negative"),
    ("failure_category_enc", 0.0, 3.0, "failure_category_enc must be 0–3"),
]

# ── Module-level singletons ────────────────────────────────────────────────────

_clf: Any = None
_reg: Any = None
_scaler: Any = None
_label_encoder: Any = None
_meta: dict = {}
_feature_cols: list[str] = []
_use_scaler: bool = False
_loaded: bool = False
_load_ms: float = 0.0


def _load_models() -> None:
    """Load all model artifacts from disk. Called once at first use (singleton)."""
    global _clf, _reg, _scaler, _label_encoder, _meta, _feature_cols
    global _use_scaler, _loaded, _load_ms

    t0 = time.perf_counter()

    meta_path = _MODEL_DIR / "meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"meta.json not found at {meta_path}")

    with open(meta_path, "r", encoding="utf-8") as fh:
        _meta = json.load(fh)

    _feature_cols = load_feature_cols()

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        _clf          = joblib.load(_MODEL_DIR / "classifier.joblib")
        _reg          = joblib.load(_MODEL_DIR / "regressor.joblib")
        _scaler       = joblib.load(_MODEL_DIR / "scaler.joblib")
        _label_encoder = joblib.load(_MODEL_DIR / "label_encoder.joblib")

    _use_scaler = _meta.get("best_classifier") == "Logistic Regression"
    _loaded = True

    _load_ms = round((time.perf_counter() - t0) * 1000, 1)
    log.info(
        "Engine B loaded | classifier=%s | regressor=%s | features=%d | "
        "use_scaler=%s | train_rows=%s | load_time=%.0f ms",
        _meta.get("best_classifier", "?"),
        _meta.get("best_regressor", "?"),
        len(_feature_cols),
        _use_scaler,
        _meta.get("train_rows", "?"),
        _load_ms,
    )


def _ensure_loaded() -> None:
    """Lazily load models on first call."""
    if not _loaded:
        _load_models()


# ── Input Validation (Task 8) ──────────────────────────────────────────────────

def validate_telemetry(telemetry: dict) -> None:
    """
    Validate telemetry values against physical bounds.

    Raises
    ------
    ValueError
        With a descriptive message listing every invalid field.
    """
    errors: list[str] = []

    for field, min_val, max_val, description in _VALIDATION_BOUNDS:
        if field not in telemetry:
            continue  # Optional fields that are absent are fine
        try:
            val = float(telemetry[field])
        except (TypeError, ValueError):
            errors.append(f"  - {field}: cannot convert '{telemetry[field]}' to float")
            continue

        if min_val is not None and val < min_val:
            errors.append(
                f"  - {field}: {val} is below minimum ({min_val}). {description}"
            )
        if max_val is not None and val > max_val:
            errors.append(
                f"  - {field}: {val} exceeds maximum ({max_val}). {description}"
            )

    # Reject missing required identifiers
    if not telemetry.get("site", "").strip():
        errors.append("  - site: must not be empty")

    if errors:
        raise ValueError(
            "Telemetry input validation failed:\n" + "\n".join(errors)
        )


# ── Internal helpers ───────────────────────────────────────────────────────────

def _compute_confidence(proba: np.ndarray) -> tuple[float, float]:
    """
    Compute calibrated confidence from class probability vector.

    Strategy
    --------
    Uses raw max-probability as the primary confidence signal (predict_proba
    is already well-calibrated for XGBoost on clean data).

    Applies a small entropy-based discount so that borderline predictions
    (where the runner-up class has significant probability mass) yield
    lower confidence than clear-cut predictions.

    Returns
    -------
    (confidence_score: float, confidence_int: float)
        confidence_score — 1 decimal place, e.g. 87.2, 96.8, 99.7
        confidence_int   — rounded integer, backward-compatible
    """
    max_p = float(np.max(proba))
    n_classes = len(proba)

    # Shannon entropy of the probability vector, normalised to [0, 1]
    # (0 = perfectly certain, 1 = maximum uncertainty)
    clipped = np.clip(proba, 1e-10, 1.0)
    entropy = float(-np.sum(clipped * np.log(clipped)))
    max_entropy = np.log(n_classes)
    normalised_entropy = entropy / max_entropy  # 0.0 – 1.0

    # Discount: subtract up to 8 percentage points for maximum uncertainty
    ENTROPY_DISCOUNT_MAX = 8.0
    discount = normalised_entropy * ENTROPY_DISCOUNT_MAX

    raw_pct = max_p * 100.0
    calibrated_pct = max(0.0, min(100.0, raw_pct - discount))

    confidence_score = round(calibrated_pct, 1)
    confidence_int = int(round(calibrated_pct))

    return confidence_score, confidence_int


def _build_reasons(telemetry: dict) -> list[str]:
    """
    Return explainability signals with actual telemetry values and thresholds.

    Rules fire only when a metric breaches its threshold.
    Returns at most 5 most-severe signals, or a clean-state message.
    Guarantees no hallucinated evidence — all values are read from telemetry.
    """
    triggered: list[tuple[float, str]] = []  # (severity_score, message)

    for feat, threshold, msg_template, op in _REASON_RULES:
        raw = telemetry.get(feat)
        if raw is None:
            continue
        try:
            val = float(raw)
        except (TypeError, ValueError):
            continue

        if op == ">=" and val >= threshold:
            # Severity = how far above threshold (normalised)
            severity = (val - threshold) / max(threshold, 1.0)
            triggered.append((severity, msg_template.format(val=round(val, 2))))
        elif op == "<" and val < threshold:
            severity = (threshold - val) / max(threshold, 0.01)
            triggered.append((severity, msg_template.format(val=round(val, 3))))

    if not triggered:
        return ["All monitored metrics are within normal operating bounds"]

    # Deduplicate messages (keep highest severity per message prefix)
    seen_prefixes: set[str] = set()
    unique_reasons: list[str] = []
    for severity, msg in sorted(triggered, reverse=True):
        # Use the first 20 chars as a deduplication key (same feature, different threshold)
        prefix = msg[:20]
        if prefix not in seen_prefixes:
            seen_prefixes.add(prefix)
            unique_reasons.append(msg)

    return unique_reasons[:5]


def _build_risk_rationale(
    condition: str,
    risk: str,
    proba: np.ndarray,
    feature_cols: list[str],
) -> str:
    """Return a one-sentence explanation for the selected risk level."""
    max_p = float(np.max(proba))
    top_feat = ""
    if hasattr(_clf, "feature_importances_") and feature_cols:
        idx = int(np.argmax(_clf.feature_importances_))
        if idx < len(feature_cols):
            top_feat = f"; primary driver: {feature_cols[idx]}"

    return (
        f"Model assigned '{condition}' (risk={risk}) with "
        f"{max_p * 100:.1f}% raw probability mass{top_feat}"
    )


def _tti_to_str(tti_minutes: float) -> str:
    """Convert numeric TTI (minutes) to a human-readable string."""
    if tti_minutes <= 0:
        return "Immediate"
    if tti_minutes < 60:
        return f"{tti_minutes:.0f} minutes"
    hours = tti_minutes / 60.0
    return f"{hours:.1f} hours"


def _get_top_features(n: int = 3) -> list[dict]:
    """Return the top-n most important features from the XGBoost classifier."""
    if not hasattr(_clf, "feature_importances_") or not _feature_cols:
        return []
    importances = _clf.feature_importances_
    top_idx = np.argsort(importances)[::-1][:n]
    return [
        {"feature": _feature_cols[i], "importance": round(float(importances[i]), 4)}
        for i in top_idx
        if i < len(_feature_cols)
    ]


def _build_metrics(telemetry: dict) -> dict:
    """
    Build the full metrics dict with all provided telemetry values.

    Short aliases are retained for backward compatibility with context_builder
    and any consumers reading the old field names.
    Only includes values that are actually present in the telemetry input.
    """
    metrics: dict[str, Any] = {}

    # Short aliases (backward-compatible)
    if "latency_ms" in telemetry:
        metrics["latency"] = round(float(telemetry["latency_ms"]), 2)
    if "packet_loss_pct" in telemetry:
        metrics["packet_loss"] = round(float(telemetry["packet_loss_pct"]), 3)
    if "utilization_pct" in telemetry:
        metrics["utilization"] = round(float(telemetry["utilization_pct"]), 2)
    if "jitter_ms" in telemetry:
        metrics["jitter"] = round(float(telemetry["jitter_ms"]), 2)
    if "bgp_flaps" in telemetry:
        metrics["bgp_flaps"] = int(telemetry["bgp_flaps"])

    # Full field names (Task 5 — complete telemetry passthrough)
    _float_fields = [
        "latency_ms", "packet_loss_pct", "utilization_pct",
        "jitter_ms", "queue_length", "throughput_mbps",
    ]
    _int_fields = ["rx_bytes", "tx_bytes"]
    _round1_fields = ["active_flows", "queue_length"]

    for field in _float_fields:
        if field in telemetry:
            metrics[field] = round(float(telemetry[field]), 2)
    for field in _round1_fields:
        if field in telemetry and field not in metrics:
            metrics[field] = round(float(telemetry[field]), 1)
    for field in _int_fields:
        if field in telemetry:
            metrics[field] = int(telemetry[field])

    # Additional optional fields
    for field in ("active_flows",):
        if field in telemetry and field not in metrics:
            metrics[field] = round(float(telemetry[field]), 0)

    return metrics


# ── Public API ─────────────────────────────────────────────────────────────────

def validate_engine() -> tuple[bool, str]:
    """
    Validate Engine B is fully operational.

    Checks required model files exist, loads all artifacts, verifies feature
    count and label encoder classes, then runs a smoke-test prediction.

    Returns
    -------
    (success: bool, message: str)
    """
    try:
        required = [
            "classifier.joblib", "regressor.joblib",
            "scaler.joblib", "label_encoder.joblib", "meta.json",
        ]
        for fname in required:
            fpath = _MODEL_DIR / fname
            if not fpath.exists():
                return False, f"Missing model artifact: {fname}"
            if fpath.stat().st_size == 0:
                return False, f"Model artifact is empty: {fname}"

        _load_models()

        if not _feature_cols:
            return False, "feature_cols is empty in meta.json"

        # Verify label encoder contains expected classes
        expected = {"Normal", "Warning", "High Risk", "Critical", "Failure"}
        actual   = set(_label_encoder.classes_)
        if not expected.issubset(actual):
            return False, f"Label encoder missing classes: {expected - actual}"

        # Verify feature count matches classifier expectation
        if hasattr(_clf, "n_features_in_"):
            expected_n = int(_clf.n_features_in_)
            if expected_n != len(_feature_cols):
                return False, (
                    f"Feature count mismatch: classifier expects {expected_n} "
                    f"but meta.json has {len(_feature_cols)}"
                )

        # Smoke-test prediction with all-zero feature vector
        sample = {f: 0.0 for f in _feature_cols}
        sample["site"]   = "smoke-test"
        sample["device"] = "smoke-device"
        result = predict(sample)

        required_keys = {
            "site", "device", "risk", "confidence", "confidence_score",
            "time_to_impact", "time_to_impact_minutes", "network_condition",
            "metrics", "prediction_reason", "timestamp",
            "prediction_engine", "model_version", "prediction_latency_ms",
        }
        missing = required_keys - result.keys()
        if missing:
            return False, f"Prediction output missing keys: {missing}"

        return True, (
            f"Engine B validated | classifier={_meta.get('best_classifier', '?')} "
            f"| regressor={_meta.get('best_regressor', '?')} "
            f"| features={len(_feature_cols)} "
            f"| train_rows={_meta.get('train_rows', '?')} "
            f"| load_time={_load_ms:.0f} ms"
        )

    except Exception as exc:
        log.exception("Engine B validation failed")
        return False, str(exc)


def predict(telemetry: dict) -> dict:
    """
    Run Engine B prediction on a telemetry dict.

    Parameters
    ----------
    telemetry : dict
        Network telemetry from TelemetryInput.model_dump().
        All feature fields default to 0 when absent.
        Invalid values (negative latency, utilization > 100, etc.)
        raise ValueError with descriptive messages.

    Returns
    -------
    dict
        Keys: timestamp, site, device, risk, network_condition,
              confidence, confidence_score, time_to_impact,
              time_to_impact_minutes, prediction_reason,
              top_features, risk_rationale, metrics,
              model_version, prediction_engine,
              prediction_latency_ms, feature_map_ms, inference_ms

    Raises
    ------
    ValueError
        If telemetry contains impossible or out-of-range values.
    """
    t_total = time.perf_counter()

    # ── Input validation (Task 8) ────────────────────────────────────────────
    validate_telemetry(telemetry)

    _ensure_loaded()

    # ── Feature mapping (Task 7 — timed) ────────────────────────────────────
    t_map = time.perf_counter()
    X = build_feature_vector(telemetry, _feature_cols)
    map_ms = round((time.perf_counter() - t_map) * 1000, 2)

    # ── Inference (Task 7 — timed) ───────────────────────────────────────────
    t_inf = time.perf_counter()
    X_clf  = _scaler.transform(X) if _use_scaler else X
    label_idx = int(_clf.predict(X_clf)[0])
    proba     = _clf.predict_proba(X_clf)[0]
    inf_ms = round((time.perf_counter() - t_inf) * 1000, 2)

    # ── Confidence calibration (Task 1) ─────────────────────────────────────
    confidence_score, confidence_int = _compute_confidence(proba)

    condition   = str(_label_encoder.inverse_transform([label_idx])[0])
    risk        = _CONDITION_TO_RISK.get(condition, "Low")
    tti_minutes = max(0.0, round(float(_reg.predict(X)[0]), 1))

    total_ms = round((time.perf_counter() - t_total) * 1000, 2)

    # ── Structured logging (Task 10) ────────────────────────────────────────
    log.info(
        "Engine B predict | site=%s device=%s | condition=%s risk=%s "
        "confidence=%.1f%% tti=%.1f min | "
        "map_ms=%.1f inf_ms=%.1f total_ms=%.1f",
        telemetry.get("site", "?"),
        telemetry.get("device", "?"),
        condition, risk,
        confidence_score,
        tti_minutes,
        map_ms, inf_ms, total_ms,
    )

    return {
        # ── Identity ────────────────────────────────────────────────────────
        "timestamp":              datetime.now(timezone.utc).isoformat(),
        "site":                   telemetry.get("site", "Unknown"),
        "device":                 telemetry.get("device", "Unknown"),
        # ── Prediction (Task 4 — all required fields present) ────────────────
        "risk":                   risk,
        "network_condition":      condition,
        "confidence":             confidence_int,       # int — backward compat
        "confidence_score":       confidence_score,     # float — decimal precision
        "time_to_impact":         _tti_to_str(tti_minutes),
        "time_to_impact_minutes": tti_minutes,
        # ── Explainability (Task 6) ──────────────────────────────────────────
        "prediction_reason":      _build_reasons(telemetry),
        "risk_rationale":         _build_risk_rationale(condition, risk, proba, _feature_cols),
        "top_features":           _get_top_features(3),
        # ── Metrics (Task 5 — telemetry passthrough) ─────────────────────────
        "metrics":                _build_metrics(telemetry),
        # ── Engine metadata ──────────────────────────────────────────────────
        "model_version":          _MODEL_VERSION,
        "prediction_engine":      _ENGINE_NAME,
        # ── Latency breakdown (Task 7) ───────────────────────────────────────
        "prediction_latency_ms":  total_ms,
        "feature_map_ms":         map_ms,
        "inference_ms":           inf_ms,
    }
