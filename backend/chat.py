import sys
import ollama

MODEL_NAME = "phi3"

SYSTEM_PROMPT = (
    "You are an expert AI assistant for a Network Operations Center (NOC). "
    "You specialize in MPLS, SD-WAN, BGP, and network troubleshooting. "
    "Give clear, concise, and technically accurate answers."
)


def chat_with_llm(conversation_history: list, user_input: str) -> str:
    """Send the full conversation history to Phi-3 and return the response."""
    conversation_history.append({"role": "user", "content": user_input})

    response = ollama.chat(model=MODEL_NAME, messages=conversation_history)
    answer = response["message"]["content"]

    # Add the model's reply to history so it remembers context
    conversation_history.append({"role": "assistant", "content": answer})

    return answer


def run_chat() -> None:
    """Run the interactive chat loop."""
    print("=" * 60)
    print("  OFFLINE AI NOC COPILOT — Interactive Chat")
    print("  Model : Phi-3 (running locally via Ollama)")
    print("  Type  : your question and press Enter")
    print("  Exit  : type 'exit' or press Ctrl+C")
    print("=" * 60)
    print()

    # Start conversation with a system message that sets the AI's role
    conversation_history = [{"role": "system", "content": SYSTEM_PROMPT}]

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ("exit", "quit", "q"):
                print("\n  Goodbye!\n")
                break

            print("\n  Phi-3 is thinking...\n")
            answer = chat_with_llm(conversation_history, user_input)

            print(f"Phi-3: {answer}")
            print()

        except KeyboardInterrupt:
            print("\n\n  Session ended.\n")
            break

        except Exception as e:
            print(f"\n  [ERROR] {e}")
            print("  [FIX]   Make sure Ollama is running: ollama serve\n")
            sys.exit(1)


if __name__ == "__main__":
    run_chat()
