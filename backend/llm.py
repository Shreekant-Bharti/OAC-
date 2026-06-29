import ollama

MODEL_NAME = "phi3"

# Limit response length to keep latency acceptable on CPU
GENERATION_OPTIONS = {
    "num_predict": 380,
    "temperature": 0.1,
    "num_ctx": 1500,
}


def generate(messages: list[dict]) -> str:
    response = ollama.chat(
        model=MODEL_NAME,
        messages=messages,
        options=GENERATION_OPTIONS,
    )
    return response["message"]["content"]


def generate_stream(messages: list[dict]):
    """Yields response tokens one by one for real-time CLI output."""
    stream = ollama.chat(
        model=MODEL_NAME,
        messages=messages,
        stream=True,
        options=GENERATION_OPTIONS,
    )
    for chunk in stream:
        token = chunk["message"]["content"]
        if token:
            yield token
