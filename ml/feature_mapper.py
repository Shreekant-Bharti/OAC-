import json
import logging
from pathlib import Path
from typing import Any

import numpy as np

log = logging.getLogger(__name__)

_META_PATH = Path(__file__).parent / "models" / "meta.json"

# Aliases: Engine B feature name → TelemetryInput field name
# Used when the same concept has a different name in each schema.
_FIELD_ALIASES: dict[str, str] = {
    "tunnel_uptime": "tunnel_health",  # tunnel_health (0–1) maps to tunnel_uptime (0–1)
}


def load_feature_cols() -> list[str]:
    """Load and return the ordered feature column list from meta.json."""
    with open(_META_PATH, "r", encoding="utf-8") as fh:
        meta = json.load(fh)
    cols = meta.get("feature_cols", [])
    if not cols:
        raise ValueError(f"feature_cols is empty in {_META_PATH}")
    return cols


def build_feature_vector(telemetry: dict[str, Any], feature_cols: list[str]) -> np.ndarray:
    """
    Translate a telemetry dict into a 2-D feature array (1, n_features).

    Parameters
    ----------
    telemetry : dict
        Raw telemetry dict, typically from TelemetryInput.model_dump().
    feature_cols : list[str]
        Ordered feature names as read from meta.json.  Column order is preserved.

    Returns
    -------
    np.ndarray of shape (1, len(feature_cols)) and dtype float64.

    Notes
    -----
    - Unknown or absent fields default to 0.0.
    - Field aliases are resolved before falling back to the default.
    """
    row: list[float] = []
    for feat in feature_cols:
        alias = _FIELD_ALIASES.get(feat)
        val = telemetry.get(feat)
        if val is None and alias is not None:
            val = telemetry.get(alias)
        if val is None:
            val = 0.0
        row.append(float(val))

    arr = np.array([row], dtype=np.float64)
    log.debug("Feature vector | cols=%s values=%s", feature_cols, arr[0].tolist())
    return arr
