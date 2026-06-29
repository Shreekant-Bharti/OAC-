import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.rag_pipeline import query


def run() -> None:
    print("=" * 62)
    print("  OFFLINE AI NOC COPILOT — RAG Pipeline Test")
    print("  Ask any NOC question. Type 'exit' to quit.")
    print("=" * 62)

    while True:
        try:
            question = input("\nYou: ").strip()
            if not question:
                continue
            if question.lower() in ("exit", "quit", "q"):
                print("Session ended.")
                break

            print("\n  [Retrieving context and generating answer...]\n")
            result = query(question)

            print("=" * 62)
            print(result["answer"])
            print("=" * 62)
            print(f"  Sources : {', '.join(result['sources']) or 'none'}")
            print(f"  Chunks  : {result['chunks_used']}")

        except KeyboardInterrupt:
            print("\nSession ended.")
            break
        except Exception as e:
            print(f"\n  [ERROR] {e}")
            sys.exit(1)


if __name__ == "__main__":
    run()
