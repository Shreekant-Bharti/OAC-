import sys
import ollama

MODEL_NAME = "phi3"

TEST_PROMPT = (
    "You are an expert NOC engineer. "
    "Explain in 3 bullet points what BGP route flapping is "
    "and what immediate actions an engineer should take."
)


def send_prompt_to_llm(model: str, prompt: str) -> str:
    """Send a prompt to a local Ollama model and return the response text."""
    response = ollama.chat(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response["message"]["content"]


def run_test() -> None:
    """Run the LLM connection test and print the result."""
    print("=" * 60)
    print("  OFFLINE AI NOC COPILOT — LLM CONNECTION TEST")
    print("=" * 60)
    print(f"  Model  : {MODEL_NAME}")
    print(f"  Prompt : {TEST_PROMPT[:60]}...")
    print("=" * 60)
    print()

    try:
        print("  [INFO] Sending prompt to Phi-3 via Ollama...\n")
        answer = send_prompt_to_llm(model=MODEL_NAME, prompt=TEST_PROMPT)

        print("=" * 60)
        print("  PHI-3 RESPONSE")
        print("=" * 60)
        print(answer)
        print("=" * 60)
        print("\n  [SUCCESS] Connection working. Ready for Step 4.\n")

    except ConnectionError as e:
        print(f"\n  [ERROR] Cannot connect to Ollama: {e}")
        print("  [FIX]   Run: ollama serve\n")
        sys.exit(1)

    except Exception as e:
        print(f"\n  [ERROR] {e}")
        print("  [FIX]   Run: ollama pull phi3\n")
        sys.exit(1)


if __name__ == "__main__":
    run_test()
