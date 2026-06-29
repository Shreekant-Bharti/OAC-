import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000"
pass_count = fail_count = 0


def ok(msg):
    global pass_count
    pass_count += 1
    print(f"  [PASS]  {msg}")


def fail(msg):
    global fail_count
    fail_count += 1
    print(f"  [FAIL]  {msg}")


def post(path, body):
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        BASE + path, data=data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=10) as r:
        return json.loads(r.read())


print("=" * 65)
print("  LIVE API ENDPOINT VALIDATION — ISRO NOC Copilot")
print("=" * 65)

# ── GET /health ────────────────────────────────────────────────────
print("\n[1] GET /health")
try:
    h = get("/health")
    print(f"  status            : {h.get('status')}")
    print(f"  prediction_engine : {h.get('prediction_engine')}")
    print(f"  ml_model_loaded   : {h.get('ml_model_loaded')}")
    print(f"  version           : {h.get('version')}")
    if h.get("status") == "ok" and h.get("ml_model_loaded"):
        ok("Health OK, Engine B loaded")
    elif h.get("status") == "ok":
        ok("Health OK (Engine A fallback)")
    else:
        fail(f"Health status: {h.get('status')}")
except Exception as e:
    fail(f"GET /health failed: {e}")

# ── POST /api/predict (Normal) ─────────────────────────────────────
print("\n[2] POST /api/predict — Normal scenario")
NORMAL = {
    "site": "HQ-Mumbai", "device": "PE-MUM-01",
    "latency_ms": 12.0, "packet_loss_pct": 0.05, "utilization_pct": 35.0,
    "jitter_ms": 2.1, "queue_length": 80.0, "active_flows": 180.0,
    "tunnel_health": 1.0, "tunnel_uptime": 1.0,
    "throughput_mbps": 600.0, "rx_bytes": 40000000, "tx_bytes": 35000000,
    "failure_category_enc": 0,
}
try:
    r = post("/api/predict", NORMAL)
    print(f"  risk              : {r.get('risk')}")
    print(f"  network_condition : {r.get('network_condition')}")
    print(f"  confidence_score  : {r.get('confidence_score')}")
    print(f"  confidence (int)  : {r.get('confidence')}")
    print(f"  time_to_impact    : {r.get('time_to_impact')}")
    print(f"  latency_ms field  : {r.get('prediction_latency_ms')} ms")
    print(f"  reasons           : {r.get('prediction_reason')}")
    required = {"timestamp", "site", "device", "risk", "confidence",
                "confidence_score", "network_condition", "time_to_impact",
                "prediction_reason", "metrics", "model_version",
                "prediction_engine", "prediction_latency_ms"}
    missing = required - r.keys()
    if missing:
        fail(f"Missing fields: {missing}")
    else:
        ok("All required fields present in response")
    if isinstance(r.get("confidence_score"), (int, float)):
        ok(f"confidence_score is numeric: {r['confidence_score']}")
    else:
        fail(f"confidence_score wrong type: {type(r.get('confidence_score'))}")
except Exception as e:
    fail(f"POST /api/predict normal failed: {e}")

# ── POST /api/predict (Critical) ──────────────────────────────────
print("\n[3] POST /api/predict — Critical scenario")
CRITICAL = {
    "site": "Branch-3", "device": "WAN-Edge-B3-01",
    "latency_ms": 115.0, "packet_loss_pct": 6.5, "utilization_pct": 95.0,
    "jitter_ms": 38.0, "queue_length": 310.0, "active_flows": 480.0,
    "tunnel_health": 0.28, "tunnel_uptime": 0.28,
    "throughput_mbps": 1800.0, "rx_bytes": 120000000, "tx_bytes": 110000000,
    "failure_category_enc": 2,
}
try:
    r2 = post("/api/predict", CRITICAL)
    print(f"  risk              : {r2.get('risk')}")
    print(f"  confidence_score  : {r2.get('confidence_score')}")
    print(f"  time_to_impact    : {r2.get('time_to_impact')}")
    print("  reasons:")
    for reason in r2.get("prediction_reason", []):
        print(f"    - {reason}")
    ok(f"Critical prediction returned risk={r2.get('risk')}")
    reasons = r2.get("prediction_reason", [])
    value_reasons = [r for r in reasons if any(c.isdigit() for c in r)]
    if value_reasons:
        ok(f"Reasons contain actual telemetry values ({len(value_reasons)} found)")
    else:
        fail("Reasons do not contain telemetry values")
except Exception as e:
    fail(f"POST /api/predict critical failed: {e}")

# ── POST /api/predict (Invalid — expect 422) ──────────────────────
print("\n[4] POST /api/predict — Invalid telemetry (expect HTTP 422)")
INVALID = {
    "site": "Test", "device": "DEV",
    "latency_ms": -50.0, "packet_loss_pct": 0.5, "utilization_pct": 50.0,
}
try:
    post("/api/predict", INVALID)
    fail("Expected HTTP 422 but got 200")
except urllib.error.HTTPError as e:
    body = json.loads(e.read())
    print(f"  status code : {e.code}")
    print(f"  detail      : {str(body.get('detail',''))[:80]}")
    if e.code == 422:
        ok("Negative latency correctly rejected with HTTP 422")
    else:
        fail(f"Expected 422, got {e.code}")
except Exception as e:
    fail(f"Unexpected error: {e}")

# ── Final summary ──────────────────────────────────────────────────
print()
print("=" * 65)
total = pass_count + fail_count
print(f"  Passed : {pass_count} / {total}")
print(f"  Failed : {fail_count} / {total}")
if fail_count == 0:
    print("  ALL LIVE API TESTS PASSED")
else:
    print(f"  {fail_count} TEST(S) FAILED")
print("=" * 65)
