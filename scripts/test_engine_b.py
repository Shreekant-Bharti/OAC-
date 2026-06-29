import json
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.predict_v2 import validate_engine, predict  # noqa: E402

# ── Test scenarios ─────────────────────────────────────────────────────────────

SCENARIOS: list[dict] = [
    {
        "label": "HIGH RISK — Link congestion + BGP instability",
        "input": {
            "site": "Branch-2",
            "device": "WAN-Edge-B2-01",
            "utilization_pct": 92.0,
            "packet_loss_pct": 4.2,
            "latency_ms": 72.0,
            "jitter_ms": 13.0,
            "queue_length": 210.0,
            "active_flows": 390.0,
            "tunnel_uptime": 1.0,
            "throughput_mbps": 850.0,
            "rx_bytes": 58_000_000.0,
            "tx_bytes": 54_000_000.0,
            "bgp_flaps": 7,
            "failure_category_enc": 0,
        },
    },
    {
        "label": "NORMAL — Healthy link, all metrics within bounds",
        "input": {
            "site": "HQ-Delhi",
            "device": "PE-DEL-01",
            "utilization_pct": 28.0,
            "packet_loss_pct": 0.0,
            "latency_ms": 9.0,
            "jitter_ms": 2.0,
            "queue_length": 65.0,
            "active_flows": 180.0,
            "tunnel_uptime": 1.0,
            "throughput_mbps": 310.0,
            "rx_bytes": 35_000_000.0,
            "tx_bytes": 31_000_000.0,
            "bgp_flaps": 0,
            "failure_category_enc": 0,
        },
    },
    {
        "label": "CRITICAL — BGP flapping + tunnel instability",
        "input": {
            "site": "Branch-3",
            "device": "WAN-Edge-B3-01",
            "utilization_pct": 48.0,
            "packet_loss_pct": 2.1,
            "latency_ms": 42.0,
            "jitter_ms": 16.0,
            "queue_length": 120.0,
            "active_flows": 230.0,
            "tunnel_uptime": 0.3,
            "throughput_mbps": 530.0,
            "rx_bytes": 60_000_000.0,
            "tx_bytes": 58_000_000.0,
            "bgp_flaps": 18,
            "failure_category_enc": 1,
        },
    },
]


# ── Runner ─────────────────────────────────────────────────────────────────────

def main() -> None:
    sep = "=" * 62

    print(sep)
    print("  Engine B — Standalone Validation & Test Runner")
    print("  ISRO Bharatiya Antariksh Hackathon 2026")
    print(sep)

    # Step 1: Validate engine
    print("\n[1/2] Validating Engine B ...")
    t0 = time.perf_counter()
    ok, msg = validate_engine()
    load_ms = (time.perf_counter() - t0) * 1000

    if ok:
        print(f"  [OK] {msg}")
        print(f"  [OK] Load time: {load_ms:.0f} ms")
    else:
        print(f"  [FAIL] FAILED: {msg}")
        sys.exit(1)

    # Step 2: Run scenarios
    print(f"\n[2/2] Running {len(SCENARIOS)} prediction scenarios ...\n")

    all_passed = True
    for i, scenario in enumerate(SCENARIOS, 1):
        print("-" * 62)
        print(f"  Scenario {i}: {scenario['label']}")
        print("-" * 62)

        try:
            result = predict(scenario["input"])
            print(json.dumps(result, indent=2))

            # Quick sanity assertions
            assert result["risk"] in ("Low", "Medium", "High", "Critical"), \
                f"Unexpected risk: {result['risk']}"
            assert 0 <= result["confidence"] <= 100, \
                f"Confidence out of range: {result['confidence']}"
            assert "network_condition" in result, "Missing network_condition"
            assert "prediction_reason" in result, "Missing prediction_reason"
            print(f"  [OK] Assertions passed\n")

        except AssertionError as exc:
            print(f"  [FAIL] Assertion failed: {exc}\n")
            all_passed = False
        except Exception as exc:
            log.exception("Scenario %d failed", i)
            all_passed = False

    print(sep)
    if all_passed:
        print("  [OK] Engine B is ready for production.")
    else:
        print("  [FAIL] Some scenarios failed -- review output above.")
    print(sep)

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
