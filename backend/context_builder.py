from backend.schemas import PredictionInput


def _format_prediction(prediction: PredictionInput) -> str:
    m = prediction.metrics

    lines = [
        "PREDICTION ENGINE OUTPUT",
        f"  Site              : {prediction.site}",
        f"  Risk Level        : {prediction.risk}",
    ]

    if prediction.network_condition:
        lines.append(f"  Network Condition : {prediction.network_condition}")

    lines += [
        f"  Confidence        : {prediction.confidence}%",
        f"  Time to Impact    : {prediction.time_to_impact}",
        "",
        "LIVE METRICS",
        f"  Latency           : {m.latency_ms} ms",
        f"  Packet Loss       : {m.packet_loss_percent}%",
        f"  Link Utilization  : {m.utilization_percent}%",
        f"  BGP Flaps         : {m.bgp_flaps}",
    ]

    if prediction.prediction_reason:
        lines.append("")
        lines.append("PREDICTION SIGNALS (engine explainability)")
        for reason in prediction.prediction_reason:
            lines.append(f"  - {reason}")

    return "\n".join(lines)


def _format_chunks(chunks: list[dict]) -> str:
    if not chunks:
        return "No relevant documents found in the knowledge base."
    parts = []
    for i, chunk in enumerate(chunks, 1):
        header = (
            f"[Document {i} | {chunk['source']} "
            f"| Page {chunk['page']} | Relevance {chunk['score']}]"
        )
        parts.append(f"{header}\n{chunk['content']}")
    return "\n\n---\n\n".join(parts)


def build_context(
    prediction: PredictionInput,
    chunks: list[dict],
    question: str,
) -> str:
    return (
        f"{_format_prediction(prediction)}\n\n"
        f"RETRIEVED KNOWLEDGE BASE DOCUMENTS\n"
        f"{_format_chunks(chunks)}\n\n"
        f"OPERATOR QUESTION\n"
        f"{question}"
    )
