import argparse
import json
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("[ERROR] 'requests' not installed.  Run: pip install requests")
    sys.exit(1)

BASE_URL = "http://localhost:8000"

SEP  = "=" * 65
DASH = "-" * 65

DEMO_TELEMETRY = {
    "site": "Branch-2",
    "device": "WAN-Edge-B2-01",
    "latency_ms": 72.0,
    "packet_loss_pct": 4.0,
    "jitter_ms": 12.0,
    "utilization_pct": 92.0,
    "cpu_pct": 78.0,
    "memory_pct": 72.0,
    "bgp_flaps": 7,
    "ospf_events": 2,
    "tunnel_health": 1.0,
    "interface_errors": 5,
    "queue_length": 210.0,
    "active_flows": 390.0,
    "tunnel_uptime": 1.0,
    "throughput_mbps": 850.0,
    "rx_bytes": 58_000_000.0,
    "tx_bytes": 54_000_000.0,
    "failure_category_enc": 0,
}

DEMO_QUESTION = "What is the root cause and what immediate actions should the operator take?"


# ── Formatting helpers ─────────────────────────────────────────────────────────

def _banner(title: str) -> None:
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


def _ok(label: str, value: str = "") -> None:
    suffix = f"  {value}" if value else ""
    print(f"  [OK] {label}{suffix}")


def _fail(label: str, reason: str = "") -> None:
    suffix = f": {reason}" if reason else ""
    print(f"  [FAIL] {label}{suffix}")


def _section(title: str) -> None:
    print(f"\n  --- {title} ---")


def _field(label: str, value) -> None:
    print(f"  {label:<22}: {value}")


# ── Demo steps ─────────────────────────────────────────────────────────────────

def demo_health() -> bool:
    _banner("STEP 1 / 4 — Health Check  (GET /health)")
    try:
        t0 = time.perf_counter()
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        ms = (time.perf_counter() - t0) * 1000
        r.raise_for_status()
        d = r.json()

        _field("Status",            d.get("status", "?"))
        _field("Version",           d.get("version", "?"))
        _field("Prediction Engine", d.get("prediction_engine", "?"))
        _field("ML Model Loaded",   d.get("ml_model_loaded", "?"))
        _field("LLM Model",         d.get("model", "?"))
        _field("Vector DB",         d.get("vector_db", "?"))
        _field("Knowledge Chunks",  d.get("chunks", "?"))
        _field("Startup Time",      d.get("startup_time", "?"))
        _field("Response Time",     f"{ms:.0f} ms")

        _ok("Health endpoint operational")
        return True
    except Exception as exc:
        _fail("Health endpoint", str(exc))
        return False


def demo_predict() -> dict | None:
    _banner("STEP 2 / 4 — ML Prediction  (POST /api/predict)")
    print(f"  Site   : {DEMO_TELEMETRY['site']}")
    print(f"  Device : {DEMO_TELEMETRY['device']}")
    print(f"  Input  : latency={DEMO_TELEMETRY['latency_ms']}ms  loss={DEMO_TELEMETRY['packet_loss_pct']}%  util={DEMO_TELEMETRY['utilization_pct']}%")
    print()
    try:
        t0 = time.perf_counter()
        r = requests.post(f"{BASE_URL}/api/predict", json=DEMO_TELEMETRY, timeout=30)
        ms = (time.perf_counter() - t0) * 1000
        r.raise_for_status()
        d = r.json()

        _field("Risk Level",       d.get("risk", "?"))
        _field("Network Condition",d.get("network_condition", "?"))
        _field("Confidence",       f"{d.get('confidence', '?')}%")
        _field("Time to Impact",   d.get("time_to_impact", "?"))
        _field("Engine Latency",   f"{d.get('prediction_latency_ms', '?')} ms")
        _field("API Response",     f"{ms:.0f} ms")

        reasons = d.get("prediction_reason", [])
        if reasons:
            _section("Prediction Signals (Explainability)")
            for r_ in reasons:
                print(f"    - {r_}")

        _ok("Prediction endpoint operational")
        return d
    except Exception as exc:
        _fail("Prediction endpoint", str(exc))
        return None


def demo_query(pred: dict) -> bool:
    _banner("STEP 3 / 4 — RAG Query  (POST /api/query)")
    payload = {
        "question": DEMO_QUESTION,
        "prediction": {
            "site":          pred["site"],
            "risk":          pred["risk"],
            "confidence":    pred["confidence"],
            "time_to_impact":pred["time_to_impact"],
            "network_condition": pred.get("network_condition", ""),
            "prediction_reason": pred.get("prediction_reason", []),
            "metrics": {
                "latency_ms":         pred["metrics"]["latency"],
                "packet_loss_percent":pred["metrics"]["packet_loss"],
                "utilization_percent":pred["metrics"]["utilization"],
                "bgp_flaps":          pred["metrics"]["bgp_flaps"],
            },
        },
    }
    print(f"  Question: {DEMO_QUESTION}")
    print(f"  Waiting for Phi-3 to generate report (may take 30-120 seconds)...")
    try:
        t0 = time.perf_counter()
        r = requests.post(f"{BASE_URL}/api/query", json=payload, timeout=180)
        ms = (time.perf_counter() - t0) * 1000
        r.raise_for_status()
        d = r.json()

        _field("Sources Used",  ", ".join(d.get("sources", [])) or "none")
        _field("Chunks Used",   d.get("chunks_used", "?"))
        _field("Response Time", f"{ms:.0f} ms")
        _section("NOC Report")
        print()
        for line in d.get("report", "").split("\n"):
            print(f"  {line}")
        print()
        _ok("RAG query endpoint operational")
        return True
    except Exception as exc:
        _fail("RAG query endpoint", str(exc))
        return False


def demo_copilot() -> bool:
    _banner("STEP 4 / 4 — Full Copilot  (POST /api/copilot)")
    payload = {"telemetry": DEMO_TELEMETRY, "question": DEMO_QUESTION}
    print(f"  Running full pipeline: Telemetry -> Engine B -> ChromaDB -> Phi-3")
    print(f"  Waiting for Phi-3 (may take 30-120 seconds)...")
    try:
        t0 = time.perf_counter()
        r = requests.post(f"{BASE_URL}/api/copilot", json=payload, timeout=240)
        ms = (time.perf_counter() - t0) * 1000
        r.raise_for_status()
        d = r.json()

        _section("Prediction Summary")
        _field("Site",             d.get("site", "?"))
        _field("Risk",             d.get("risk", "?"))
        _field("Condition",        d.get("network_condition", "?"))
        _field("Confidence",       f"{d.get('confidence', '?')}%")
        _field("Time to Impact",   d.get("time_to_impact", "?"))
        _field("Total Time",       f"{ms:.0f} ms")

        _section("NOC Report (Phi-3 Output)")
        print()
        for line in d.get("report", "").split("\n"):
            print(f"  {line}")
        print()

        _section("Knowledge Sources")
        for src in d.get("sources", []):
            print(f"    - {src}")

        _ok("End-to-end copilot pipeline operational")
        return True
    except Exception as exc:
        _fail("Copilot endpoint", str(exc))
        return False


def demo_ml_only() -> None:
    """Run Engine B standalone — no server required."""
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from ml.predict_v2 import validate_engine, predict

    _banner("ENGINE B — Standalone Demo (no server required)")
    print("  Loading XGBoost classifier + RF Regressor...")

    ok, msg = validate_engine()
    if not ok:
        _fail("Engine B", msg)
        sys.exit(1)
    _ok("Engine B loaded", msg)

    scenarios = [
        ("Branch-2 — Congestion",    {**{k: v for k, v in DEMO_TELEMETRY.items()}}),
        ("HQ-Delhi — Healthy link",  {"site": "HQ-Delhi", "device": "PE-DEL-01",
                                      "latency_ms": 9, "packet_loss_pct": 0,
                                      "utilization_pct": 28, "queue_length": 65,
                                      "active_flows": 180, "throughput_mbps": 310,
                                      "rx_bytes": 35_000_000, "tx_bytes": 31_000_000}),
    ]

    for label, telemetry in scenarios:
        _section(label)
        result = predict(telemetry)
        _field("Risk",             result["risk"])
        _field("Network Condition",result["network_condition"])
        _field("Confidence",       f"{result['confidence']}%")
        _field("Time to Impact",   result["time_to_impact"])
        _field("Engine Latency",   f"{result['prediction_latency_ms']} ms")
        for r_ in result.get("prediction_reason", []):
            print(f"    Signal: {r_}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main(host: str, port: int, ml_only: bool) -> None:
    global BASE_URL
    BASE_URL = f"http://{host}:{port}"

    print(SEP)
    print("  ISRO OFFLINE AI NOC COPILOT — Demonstration")
    print("  ISRO Bharatiya Antariksh Hackathon 2026")
    print(SEP)
    print(f"  Backend  : {BASE_URL}")
    print(f"  Mode     : {'Engine B standalone' if ml_only else 'Full pipeline (server required)'}")
    print(SEP)

    if ml_only:
        demo_ml_only()
        print(f"\n{SEP}")
        print("  Demo complete.")
        print(SEP)
        return

    results = []
    results.append(demo_health())

    pred = demo_predict()
    results.append(pred is not None)

    if pred:
        results.append(demo_query(pred))
        results.append(demo_copilot())

    passed = sum(results)
    total  = len(results)

    print(f"\n{SEP}")
    print(f"  Demo Results: {passed}/{total} steps passed")
    if passed == total:
        print("  [OK] System is ready for live demonstration.")
    else:
        print("  [WARN] Some steps failed. Check that the server and Ollama are running.")
    print(SEP)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="ISRO NOC Copilot — Judge demonstration script"
    )
    parser.add_argument("--host",    default="localhost")
    parser.add_argument("--port",    type=int, default=8000)
    parser.add_argument("--ml-only", action="store_true",
                        help="Run Engine B standalone without the FastAPI server")
    args = parser.parse_args()
    main(args.host, args.port, args.ml_only)
