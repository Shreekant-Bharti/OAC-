import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

SITES = {
    "Branch-1": ["WAN-Edge-B1-01", "WAN-Edge-B1-02"],
    "Branch-2": ["WAN-Edge-B2-01", "WAN-Edge-B2-02"],
    "Branch-3": ["WAN-Edge-B3-01", "WAN-Edge-B3-02"],
    "HQ-Mumbai": ["PE-MUM-01", "CE-PUN-02"],
    "HQ-Delhi":  ["PE-DEL-01", "PE-DEL-02"],
}

INTERVAL_MINUTES = 5
DAYS = 30
OUTPUT_PATH = Path("ml/data/network_telemetry.csv")


def _normal(n: int, rng: np.random.Generator) -> dict:
    return {
        "latency_ms":       rng.normal(22, 4, n).clip(5, 45),
        "packet_loss_pct":  rng.exponential(0.08, n).clip(0, 0.5),
        "jitter_ms":        rng.normal(2.5, 0.5, n).clip(0.3, 6),
        "utilization_pct":  rng.normal(52, 12, n).clip(15, 75),
        "cpu_pct":          rng.normal(28, 7, n).clip(5, 55),
        "memory_pct":       rng.normal(38, 5, n).clip(20, 60),
        "bgp_flaps":        rng.poisson(0.04, n),
        "ospf_events":      rng.poisson(0.01, n),
        "tunnel_health":    rng.binomial(1, 0.99, n).astype(float),
        "interface_errors": rng.poisson(0.08, n),
        "fault_label":      np.zeros(n, dtype=int),
    }


def _degradation(n: int, rng: np.random.Generator) -> dict:
    t = np.linspace(0, 1, n)
    noise = lambda scale: rng.normal(0, scale, n)
    return {
        "latency_ms":       (22 + t * 68 + noise(6)).clip(20, 140),
        "packet_loss_pct":  (0.1 + t * 7 + rng.exponential(0.2, n)).clip(0, 12),
        "jitter_ms":        (2.5 + t * 20 + noise(2)).clip(1, 40),
        "utilization_pct":  (52 + t * 46 + noise(4)).clip(50, 100),
        "cpu_pct":          (28 + t * 62 + noise(6)).clip(20, 99),
        "memory_pct":       (38 + t * 48 + noise(3)).clip(30, 98),
        "bgp_flaps":        rng.poisson(np.maximum(0.1, t * 5), n).clip(0, 15).astype(int),
        "ospf_events":      rng.poisson(np.maximum(0.02, t * 2), n).clip(0, 6).astype(int),
        "tunnel_health":    np.where(t > 0.75, rng.binomial(1, 0.55, n), 1).astype(float),
        "interface_errors": rng.poisson(np.maximum(0.5, t * 7), n).clip(0, 28).astype(int),
        "fault_label":      np.ones(n, dtype=int),   # entire degradation segment = At-Risk
    }


def _build_device_series(
    site: str,
    device: str,
    timestamps: pd.DatetimeIndex,
    rng: np.random.Generator,
) -> pd.DataFrame:
    n = len(timestamps)
    base = _normal(n, rng)
    metrics = {k: v.copy() for k, v in base.items()}

    n_episodes = rng.integers(3, 6)
    for _ in range(n_episodes):
        seg_len = rng.integers(12, 28)
        max_start = n - seg_len - 12
        if max_start <= 30:
            continue
        start = rng.integers(30, max_start)
        seg = _degradation(seg_len, rng)
        for k in metrics:
            metrics[k][start:start + seg_len] = seg[k]

    df = pd.DataFrame(metrics)
    df.insert(0, "timestamp", timestamps)
    df.insert(1, "site", site)
    df.insert(2, "device", device)
    return df


def generate() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    total = DAYS * 24 * (60 // INTERVAL_MINUTES)
    timestamps = pd.date_range(
        start=datetime(2024, 10, 1),
        periods=total,
        freq=f"{INTERVAL_MINUTES}min",
    )

    frames = [
        _build_device_series(site, device, timestamps, rng)
        for site, devices in SITES.items()
        for device in devices
    ]

    df = pd.concat(frames, ignore_index=True)
    return df.sort_values(["site", "device", "timestamp"]).reset_index(drop=True)


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    log.info("Generating synthetic network telemetry dataset...")
    df = generate()
    df.to_csv(OUTPUT_PATH, index=False)

    log.info(f"  Rows         : {len(df):,}")
    log.info(f"  Sites        : {df['site'].nunique()}")
    log.info(f"  Devices      : {df['device'].nunique()}")
    log.info(f"  Time range   : {df['timestamp'].min()} → {df['timestamp'].max()}")
    log.info(f"  Fault rate   : {df['fault_label'].mean():.1%}")
    log.info(f"  Saved to     : {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
