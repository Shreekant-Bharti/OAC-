import logging
import re
from backend.schemas import QueryRequest, QueryResponse, HealthResponse
from backend.retriever import retrieve_context
from backend.context_builder import build_context
from backend.prompts import build_messages
from backend.llm import generate
from backend.vector_store import get_collection

log = logging.getLogger(__name__)

INSUFFICIENT = "Insufficient evidence found in the local knowledge base."
RISK_PRIORITY = {"Critical": "P1", "High": "P1", "Medium": "P2", "Low": "P3"}


def _extract_section(text: str, label: str) -> str:
    """Extract a named section from Phi-3's output."""
    pattern = rf"{label}:\s*(.*?)(?=\n[A-Z_]+:|$)"
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else ""


def _assemble_report(phi3_output: str, request: QueryRequest, sources: list[str]) -> str:
    """Combine Phi-3 analysis with Python-injected structured fields."""
    if "INSUFFICIENT" in phi3_output.upper() or not phi3_output.strip():
        return INSUFFICIENT

    p = request.prediction
    m = p.metrics
    priority = RISK_PRIORITY.get(p.risk, "P2")

    issue = _extract_section(phi3_output, "ISSUE") or "Network risk detected at affected site."
    evidence = _extract_section(phi3_output, "EVIDENCE") or f"- Utilization: {m.utilization_percent}%\n- Packet Loss: {m.packet_loss_percent}%"
    root_cause = _extract_section(phi3_output, "ROOT_CAUSE") or "See retrieved context."
    actions = _extract_section(phi3_output, "ACTIONS") or "Refer to runbook procedures."

    return (
        f"**Issue:** {issue}\n\n"
        f"**Confidence:** {p.confidence}%\n\n"
        f"**Time To Impact:** {p.time_to_impact}\n\n"
        f"**Affected Site:** {p.site}\n\n"
        f"**Evidence:**\n"
        f"- Latency: {m.latency_ms} ms | Packet Loss: {m.packet_loss_percent}% | "
        f"Utilization: {m.utilization_percent}% | BGP Flaps: {m.bgp_flaps}\n"
        f"{evidence}\n\n"
        f"**Root Cause Analysis:**\n{root_cause}\n\n"
        f"**Recommended Actions:**\n{actions}\n\n"
        f"**Priority:** {priority} — {p.risk} risk with {p.time_to_impact} to impact.\n\n"
        f"**Sources Used:** {', '.join(sources) if sources else 'none'}"
    )


def query(request: QueryRequest) -> QueryResponse:
    log.info(f"Query | site={request.prediction.site} risk={request.prediction.risk}")

    search_query = f"{request.prediction.site} {request.question}"
    chunks = retrieve_context(search_query)

    if not chunks:
        log.warning("No chunks retrieved.")
        return QueryResponse(
            report=INSUFFICIENT,
            sources=[],
            chunks_used=0,
            site=request.prediction.site,
            risk=request.prediction.risk,
            confidence=request.prediction.confidence,
        )

    context = build_context(request.prediction, chunks, request.question)
    messages = build_messages(context)
    phi3_output = generate(messages)
    sources = sorted({c["source"] for c in chunks})
    report = _assemble_report(phi3_output, request, sources)

    log.info(f"Report assembled | sources={sources} chunks={len(chunks)}")

    return QueryResponse(
        report=report,
        sources=sources,
        chunks_used=len(chunks),
        site=request.prediction.site,
        risk=request.prediction.risk,
        confidence=request.prediction.confidence,
    )


def health_check() -> HealthResponse:
    collection = get_collection()
    return HealthResponse(
        status="ok",
        model="phi3",
        collection=collection.name,
        total_chunks=collection.count(),
    )
