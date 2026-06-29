import requests
import time

url = "http://localhost:8000/api/copilot"
payload = {
    "telemetry": {
        "site": "Branch-2",
        "device": "WAN-Edge-B2-01",
        "latency_ms": 72.0,
        "packet_loss_pct": 4.0,
        "utilization_pct": 88.0,
        "jitter_ms": 25.0,
        "bgp_flaps": 5,
        "tunnel_uptime": 0.6,
        "queue_length": 220.0,
        "active_flows": 420.0,
        "throughput_mbps": 850.0,
        "rx_bytes": 65000000,
        "tx_bytes": 58000000,
        "failure_category_enc": 1
    },
    "question": "Why is this site at risk?"
}

start = time.time()
try:
    response = requests.post(url, json=payload)
    end = time.time()
    print(f"Status Code: {response.status_code}")
    print(f"Time Taken: {end - start:.2f} seconds")
    if response.status_code == 200:
        print("Success")
    else:
        print(response.text)
except Exception as e:
    print(f"Error: {e}")
