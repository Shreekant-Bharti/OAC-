import logging
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.schemas import (
    CopilotRequest, CopilotResponse,
    HealthResponse, Metrics,
    PredictionInput, QueryRequest, QueryResponse,
    TelemetryInput,
)
from backend.rag_pipeline import query as rag_query, health_check
from ml.predict import predict as _predict_engine_a

log = logging.getLogger(__name__)

_APP_VERSION = "2.0.0"

# ── Engine selection globals ───────────────────────────────────────────────────

_ml_predict: Callable = _predict_engine_a
_prediction_engine_name: str = "Engine A (rule-based)"
_engine_b_active: bool = False
_startup_time: str = ""


def _try_load_engine_b() -> None:
    """Attempt to import, validate, and activate Engine B. Falls back silently on failure."""
    global _ml_predict, _prediction_engine_name, _engine_b_active
    try:
        from ml.predict_v2 import predict as _predict_b, validate_engine
        ok, msg = validate_engine()
        if ok:
            _ml_predict = _predict_b
            _prediction_engine_name = "Engine B (XGBoost + RF Regressor)"
            _engine_b_active = True
            log.info("Prediction engine: %s | %s", _prediction_engine_name, msg)
        else:
            log.warning(
                "Engine B validation failed (%s). Falling back to Engine A.", msg
            )
    except ImportError as exc:
        log.warning("Engine B import failed (%s). Falling back to Engine A.", exc)
    except Exception:
        log.exception("Unexpected error loading Engine B. Falling back to Engine A.")


# ── Lifespan ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _startup_time
    _startup_time = datetime.now(timezone.utc).isoformat()

    log.info("Warming up ChromaDB collection...")
    from backend.vector_store import get_collection
    get_collection()

    log.info("Validating prediction engine...")
    _try_load_engine_b()

    log.info(
        "Startup complete | version=%s | engine=%s | engine_b_active=%s",
        _APP_VERSION,
        _prediction_engine_name,
        _engine_b_active,
    )
    yield


# ── Application ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="ISRO Offline AI NOC Copilot",
    description="Offline RAG + ML prediction engine for MPLS/SD-WAN network operations.",
    version=_APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _ml_dict_to_prediction(pred: dict) -> PredictionInput:
    """Convert ml_predict output dict → PredictionInput Pydantic model."""
    m = pred.get("metrics", {})
    return PredictionInput(
        site=pred["site"],
        risk=pred["risk"],
        confidence=int(pred["confidence"]),
        time_to_impact=str(pred["time_to_impact"]),
        metrics=Metrics(
            latency_ms=float(m.get("latency", 0)),
            packet_loss_percent=float(m.get("packet_loss", 0)),
            utilization_percent=float(m.get("utilization", 0)),
            bgp_flaps=int(m.get("bgp_flaps", 0)),
        ),
        # Engine B explainability fields — passed through to context_builder → Phi-3
        network_condition=pred.get("network_condition", ""),
        prediction_reason=pred.get("prediction_reason", []),
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["System"])
def health():
    """System health: Ollama model, ChromaDB, Engine B status, startup time, version."""
    base = health_check()
    return HealthResponse(
        status=base.status,
        model=base.model,
        collection=base.collection,
        total_chunks=base.total_chunks,
        prediction_engine=_prediction_engine_name,
        vector_db=base.collection,
        chunks=base.total_chunks,
        ml_model_loaded=_engine_b_active,
        startup_time=_startup_time,
        version=_APP_VERSION,
    )


@app.post("/api/predict", tags=["ML Engine"])
def predict(telemetry: TelemetryInput) -> dict:
    """
    ML Prediction Engine.
    Accepts raw network telemetry and returns a risk prediction JSON.
    Active engine: see GET /health → prediction_engine.

    Returns HTTP 422 if telemetry values are physically impossible
    (e.g. negative latency, utilization > 100%).
    """
    try:
        return _ml_predict(telemetry.model_dump())
    except ValueError as exc:
        # Raised by validate_telemetry() for impossible input values
        log.warning("Telemetry validation error | site=%s | %s", telemetry.site, exc)
        raise HTTPException(status_code=422, detail=str(exc))
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Prediction model files not found.")
    except Exception:
        log.exception("Prediction error | site=%s", telemetry.site)
        raise HTTPException(status_code=500, detail="Prediction engine error. Check server logs.")


@app.post("/api/query", response_model=QueryResponse, tags=["RAG Pipeline"])
def query(request: QueryRequest) -> QueryResponse:
    """
    RAG Query Endpoint.
    Accepts a structured prediction + operator question.
    Returns a structured NOC incident report grounded in the knowledge base.
    """
    try:
        return rag_query(request)
    except Exception:
        log.exception("RAG query error | site=%s", request.prediction.site)
        raise HTTPException(status_code=500, detail="RAG pipeline error. Check server logs.")


@app.post("/api/copilot", response_model=CopilotResponse, tags=["Copilot"])
def copilot(request: CopilotRequest) -> CopilotResponse:
    """
    Full End-to-End NOC Copilot.
    1. Runs ML prediction on raw telemetry (active engine).
    2. Feeds prediction + question into the RAG pipeline.
    3. Returns complete NOC report with prediction context.

    Returns HTTP 422 if telemetry values are physically impossible.
    """
    try:
        pred_dict = _ml_predict(request.telemetry.model_dump())
        prediction = _ml_dict_to_prediction(pred_dict)
        rag_request = QueryRequest(question=request.question, prediction=prediction)
        rag_result = rag_query(rag_request)

        return CopilotResponse(
            prediction=pred_dict,
            report=rag_result.report,
            sources=rag_result.sources,
            chunks_used=rag_result.chunks_used,
            site=pred_dict["site"],
            risk=pred_dict["risk"],
            confidence=int(pred_dict["confidence"]),
            time_to_impact=str(pred_dict["time_to_impact"]),
            network_condition=pred_dict.get("network_condition", ""),
        )
    except ValueError as exc:
        log.warning("Telemetry validation error | site=%s | %s", request.telemetry.site, exc)
        raise HTTPException(status_code=422, detail=str(exc))
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Prediction model files not found.")
    except Exception:
        log.exception("Copilot error | site=%s", request.telemetry.site)
        raise HTTPException(status_code=500, detail="Copilot pipeline error. Check server logs.")
