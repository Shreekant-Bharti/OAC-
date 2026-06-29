import sys
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.schemas import PredictionInput, QueryRequest
from backend.rag_pipeline import query, health_check

logging.basicConfig(level=logging.WARNING, format="%(levelname)s | %(message)s")

PREDICTION_FILE = Path("sample_prediction.json")

TEST_QUESTIONS = [
    "Why is this site at high risk?",
    "Which historical incident matches this prediction?",
    "What immediate action should the operator take right now?",
    "Show all evidence supporting this risk prediction.",
    "What does the current packet loss percentage indicate?",
    "Is there a runbook procedure for this type of alert?",
    "What is the correct escalation priority and who should be notified?",
    "How does this event compare to previous recorded incidents?",
    "What BGP-related steps are recommended for this situation?",
    "What is the projected impact if no action is taken in time?",
]


def load_prediction() -> PredictionInput:
    if not PREDICTION_FILE.exists():
        print(f"[ERROR] {PREDICTION_FILE} not found. Create sample_prediction.json first.")
        sys.exit(1)
    data = json.loads(PREDICTION_FILE.read_text())
    return PredictionInput(**data)


def print_report(response) -> None:
    width = 65
    print("\n" + "=" * width)
    print(response.report)
    print("=" * width)
    print(f"  Site       : {response.site}")
    print(f"  Risk       : {response.risk}")
    print(f"  Confidence : {response.confidence}%")
    print(f"  Sources    : {', '.join(response.sources) or 'none'}")
    print(f"  Chunks     : {response.chunks_used}")
    print("=" * width)


def run_single(prediction: PredictionInput, question: str) -> None:
    print("\n  [Generating NOC report...]\n")
    request = QueryRequest(question=question, prediction=prediction)
    response = query(request)
    print_report(response)


def run_all_tests(prediction: PredictionInput) -> None:
    total = len(TEST_QUESTIONS)
    print(f"\n  Running {total} test questions against knowledge base...\n")
    for i, question in enumerate(TEST_QUESTIONS, 1):
        print(f"--- [{i}/{total}] {question}")
        run_single(prediction, question)


def print_header(prediction: PredictionInput) -> None:
    width = 65
    health = health_check()
    print("=" * width)
    print("  ISRO OFFLINE AI NOC COPILOT")
    print("=" * width)
    print(f"  Site           : {prediction.site}")
    print(f"  Risk           : {prediction.risk}")
    print(f"  Confidence     : {prediction.confidence}%")
    print(f"  Time to Impact : {prediction.time_to_impact}")
    print(f"  Latency        : {prediction.metrics.latency_ms} ms")
    print(f"  Packet Loss    : {prediction.metrics.packet_loss_percent}%")
    print(f"  Utilization    : {prediction.metrics.utilization_percent}%")
    print(f"  BGP Flaps      : {prediction.metrics.bgp_flaps}")
    print("-" * width)
    print(f"  KB Status      : {health.total_chunks} chunks | model: {health.model}")
    print("=" * width)
    print("  Commands: [question] | 'test' | 'exit'")
    print("=" * width)


def run() -> None:
    prediction = load_prediction()
    print_header(prediction)

    while True:
        try:
            user_input = input("\nOperator: ").strip()

            if not user_input:
                continue
            if user_input.lower() in ("exit", "quit", "q"):
                print("Session ended.")
                break
            if user_input.lower() == "test":
                run_all_tests(prediction)
                continue

            run_single(prediction, user_input)

        except KeyboardInterrupt:
            print("\nSession ended.")
            break
        except Exception as e:
            print(f"\n  [ERROR] {e}")
            print("  [TIP]   Ensure Ollama is running: ollama serve")


if __name__ == "__main__":
    run()
