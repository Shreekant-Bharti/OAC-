from pydantic import BaseModel, Field


class Metrics(BaseModel):
    latency_ms: float = Field(..., ge=0, description="Link latency in milliseconds")
    packet_loss_percent: float = Field(..., ge=0, description="Packet loss percentage")
    utilization_percent: float = Field(..., ge=0, description="Link utilization percentage")
    bgp_flaps: int = Field(..., ge=0, description="Number of BGP flaps detected")


class PredictionInput(BaseModel):
    site: str = Field(..., description="Affected site name")
    risk: str = Field(..., description="Risk level: Critical | High | Medium | Low")
    confidence: int = Field(..., ge=0, le=100, description="Prediction confidence 0-100")
    time_to_impact: str = Field(..., description="Estimated time to service impact")
    metrics: Metrics
    # Engine B explainability fields (optional — backward-compatible with Engine A)
    network_condition: str = Field(
        default="",
        description="Engine B condition: Normal | Warning | High Risk | Critical | Failure",
    )
    prediction_reason: list[str] = Field(
        default_factory=list,
        description="Signals that contributed to this prediction",
    )


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Operator's question")
    prediction: PredictionInput


class QueryResponse(BaseModel):
    report: str = Field(..., description="Structured NOC incident report")
    sources: list[str] = Field(..., description="Knowledge base documents used")
    chunks_used: int = Field(..., description="Number of retrieved chunks")
    site: str
    risk: str
    confidence: int


class HealthResponse(BaseModel):
    # Core fields
    status: str
    model: str
    collection: str
    total_chunks: int
    # Engine B additions
    prediction_engine: str = "Engine A"
    vector_db: str = ""
    chunks: int = 0
    ml_model_loaded: bool = False
    # Monitoring fields
    startup_time: str = ""
    version: str = "2.0.0"


class TelemetryInput(BaseModel):
    # ── Core fields (required) ─────────────────────────────────────────────────
    site: str
    device: str
    latency_ms: float = Field(..., ge=0)
    packet_loss_pct: float = Field(..., ge=0)
    utilization_pct: float = Field(..., ge=0, le=100)
    # ── Extended fields — Engine A (optional, backward-compatible) ─────────────
    jitter_ms: float = Field(default=0.0, ge=0)
    cpu_pct: float = Field(default=0.0, ge=0)
    memory_pct: float = Field(default=0.0, ge=0)
    bgp_flaps: int = Field(default=0, ge=0)
    ospf_events: int = Field(default=0, ge=0)
    tunnel_health: float = Field(default=1.0, ge=0)
    interface_errors: int = Field(default=0, ge=0)
    # ── Extended fields — Engine B (optional, backward-compatible) ─────────────
    queue_length: float = Field(default=0.0, ge=0)
    active_flows: float = Field(default=0.0, ge=0)
    tunnel_uptime: float = Field(default=1.0, ge=0)
    throughput_mbps: float = Field(default=0.0, ge=0)
    rx_bytes: float = Field(default=0.0, ge=0)
    tx_bytes: float = Field(default=0.0, ge=0)
    failure_category_enc: int = Field(default=0, ge=0)


class CopilotRequest(BaseModel):
    telemetry: TelemetryInput
    question: str = Field(..., min_length=1)


class CopilotResponse(BaseModel):
    prediction: dict
    report: str
    sources: list[str]
    chunks_used: int
    site: str
    risk: str
    confidence: int
    time_to_impact: str
    network_condition: str = ""  # Engine B: Normal | Warning | High Risk | Critical | Failure
