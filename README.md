# 🛰️ Offline AI NOC Copilot

**ISRO Bharatiya Antariksh Hackathon 2026**

An industry-grade, fully offline AI assistant for MPLS/SD-WAN Network Operations Center (NOC).

---

## 🎯 Project Objective

This copilot assists network engineers with:
- Interpreting ML-generated network anomaly predictions
- Answering complex NOC questions using enterprise runbooks
- Suggesting remediation steps from historical incident data
- Understanding network topology context

**Everything runs 100% offline. No OpenAI. No Gemini. No internet.**

---

## 🏗️ Architecture

```
React Dashboard
      ↓
FastAPI Backend
      ↓
Prediction JSON + User Question
      ↓
     RAG
      ↓
  ChromaDB
      ↓
   Ollama
      ↓
    Phi-3
      ↓
Professional AI Response
```

---

## 📁 Folder Structure

| Folder           | Purpose                                                    |
|------------------|------------------------------------------------------------|
| `backend/`       | All FastAPI routes, LangChain chains, RAG pipeline logic   |
| `knowledge_base/`| Source PDF documents (runbooks, incidents, topology maps)  |
| `vector_db/`     | ChromaDB persisted vector store (auto-generated)           |
| `scripts/`       | Utility scripts: ingestion, testing, DB reset              |
| `models/`        | Local model configs, prompt templates, schema definitions  |

---

## ⚙️ Tech Stack

| Technology           | Role                                     |
|----------------------|------------------------------------------|
| Python 3.11+         | Core language                            |
| Ollama               | Local LLM runtime                        |
| Phi-3 (Microsoft)    | Offline language model                   |
| LangChain            | RAG orchestration framework              |
| ChromaDB             | Offline vector database                  |
| Sentence Transformers| Local embedding generation               |
| PyPDF                | PDF parsing                              |
| FastAPI              | REST API backend                         |
| Uvicorn              | ASGI web server                          |
| python-dotenv        | Environment configuration                |

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start Ollama (in a separate terminal)
ollama serve

# 3. Pull the Phi-3 model
ollama pull phi3

# 4. Run the backend
uvicorn backend.main:app --reload
```

---

## 👥 Team

Built for ISRO Bharatiya Antariksh Hackathon 2026.

---

## 🤖 ML Prediction Engine (Engine B)

The prediction engine uses a trained XGBoost classifier + Random Forest Regressor on 80,000 synthetic telemetry samples.

| Component | Detail |
|---|---|
| Classifier | XGBoost (5-class: Normal / Warning / High Risk / Critical / Failure) |
| Regressor | Random Forest (Time-to-Impact in minutes) |
| Features | 11 network telemetry features (see `ml/models/meta.json`) |
| Training Rows | 80,000 |
| Prediction Latency | ~35–65 ms |
| Fallback | Engine A (rule-based) activates automatically if Engine B fails validation |

### Updated Architecture

```
React Dashboard
      |
FastAPI (backend/main.py)
      |
TelemetryInput (validated schema)
      |
ml/feature_mapper.py  —  dynamic feature translation
      |
ml/predict_v2.py  —  XGBoost classifier + RF Regressor
      |
Prediction JSON: risk / confidence / TTI / network_condition / signals
      |
backend/context_builder.py  —  builds Phi-3 context with explainability
      |
backend/retriever.py  —  ChromaDB similarity search
      |
backend/prompts.py  —  structured NOC report prompt
      |
backend/llm.py  —  Phi-3 via Ollama
      |
Structured NOC Report
```

### Engine B Output Fields

| Field | Type | Description |
|---|---|---|
| `risk` | string | `Critical` / `High` / `Medium` / `Low` |
| `network_condition` | string | `Normal` / `Warning` / `High Risk` / `Critical` / `Failure` |
| `confidence` | int | 0–100% |
| `time_to_impact` | string | Human-readable, e.g. `"24 minutes"` |
| `time_to_impact_minutes` | float | Numeric TTI |
| `prediction_reason` | list[str] | Explainability signals (thresholds exceeded) |
| `prediction_latency_ms` | float | Engine inference time |

---

## 📁 Updated Folder Structure

| Folder / File | Purpose |
|---|---|
| `backend/` | FastAPI routes, RAG pipeline, prompts, context builder |
| `ml/predict_v2.py` | Engine B wrapper (XGBoost + RF Regressor) |
| `ml/feature_mapper.py` | Translates telemetry → Engine B feature vector |
| `ml/models/` | Trained model artifacts + meta.json |
| `knowledge_base/` | Source PDF documents (runbooks, incidents) |
| `vector_db/` | ChromaDB persisted vector store |
| `scripts/demo.py` | Judge demonstration script |
| `scripts/test_engine_b.py` | Standalone Engine B validator |
| `scripts/test_integration.py` | 12-test API integration suite |
| `scripts/ingest.py` | PDF → ChromaDB ingestion pipeline |

---

## 🚀 Demo Commands

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start server (Terminal 1)
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Run Engine B standalone test (Terminal 2, no server needed)
python -W ignore::UserWarning scripts/test_engine_b.py

# 4. Run the judge demo (Terminal 2, server must be running)
python scripts/demo.py

# 5. Run Engine B demo without server
python scripts/demo.py --ml-only

# 6. Run full integration test suite
python scripts/test_integration.py

# 7. Open Swagger API explorer in browser
# http://localhost:8000/docs
```

---

## 🔌 API Reference

### GET /health
Returns system status.
```json
{
  "status": "ok",
  "version": "2.0.0",
  "model": "phi3",
  "prediction_engine": "Engine B (XGBoost + RF Regressor)",
  "ml_model_loaded": true,
  "vector_db": "noc_knowledge",
  "chunks": 15,
  "startup_time": "2026-06-27T05:44:00+00:00"
}
```

### POST /api/predict
```json
// Request — minimum required fields
{
  "site": "Branch-2",
  "device": "WAN-Edge-B2-01",
  "latency_ms": 72,
  "packet_loss_pct": 4.0,
  "utilization_pct": 92
}

// Response
{
  "risk": "Critical",
  "network_condition": "Critical",
  "confidence": 92,
  "time_to_impact": "24 minutes",
  "prediction_reason": ["Latency increasing", "Packet loss increasing"],
  "prediction_latency_ms": 43.2
}
```

### POST /api/copilot
```json
// Request
{
  "telemetry": { "site": "Branch-2", "device": "WAN-Edge-B2-01",
                 "latency_ms": 72, "packet_loss_pct": 4.0, "utilization_pct": 92 },
  "question": "What is the root cause and recommended actions?"
}

// Response
{
  "risk": "Critical",
  "confidence": 92,
  "time_to_impact": "24 minutes",
  "network_condition": "Critical",
  "report": "**Issue:** ...\n**Evidence:** ...\n**Root Cause:** ...\n**Actions:** ...",
  "sources": ["incident.pdf", "runbook.pdf"],
  "chunks_used": 3
}
```

---

## 👥 Team

Built for ISRO Bharatiya Antariksh Hackathon 2026.

