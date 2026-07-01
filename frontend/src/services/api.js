/**
 * api.js — Real FastAPI client
 *
 * Calls the local FastAPI backend at localhost:8000 (or VITE_BACKEND_URL).
 * Endpoints:
 *   GET  /health          → system health
 *   POST /api/predict     → ML prediction from raw telemetry
 *   POST /api/query       → RAG grounding query
 *   POST /api/copilot     → end-to-end: predict + RAG + Phi-3
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail = err.response?.data?.detail
    let msg
    if (Array.isArray(detail)) {
      // FastAPI 422: detail is a list of Pydantic validation error objects
      // e.g. [{"loc":["body","telemetry","device"],"msg":"Field required",...}]
      msg = detail
        .map((e) => {
          const loc = Array.isArray(e.loc) ? e.loc.join(' → ') : String(e.loc ?? '')
          return loc ? `${loc}: ${e.msg}` : e.msg
        })
        .join(' | ')
    } else if (typeof detail === 'string') {
      msg = detail
    } else if (detail !== undefined && detail !== null) {
      try {
        msg = JSON.stringify(detail)
      } catch (_) {
        msg = String(detail)
      }
    } else {
      msg = err.response?.data?.message || err.message || 'Unknown error'
    }
    return Promise.reject(new Error(String(msg)))
  }
)

// ── GET /health ──────────────────────────────────────────────────────
export const getHealth = () => client.get('/health').then((r) => r.data)

// ── POST /api/predict ────────────────────────────────────────────────
// telemetry: raw network metrics object (TelemetryInput schema)
export const predict = (telemetry) =>
  client.post('/api/predict', telemetry).then((r) => r.data)

// ── POST /api/query ──────────────────────────────────────────────────
// prediction: PredictionInput, question: string
export const query = (prediction, question) =>
  client
    .post('/api/query', {
      question,
      prediction: {
        site:               prediction.site,
        risk:               prediction.risk,
        confidence:         prediction.confidence,
        time_to_impact:     prediction.time_to_impact,
        metrics: {
          latency_ms:           prediction.metrics?.latency_ms           ?? prediction.metrics?.latency      ?? 0,
          packet_loss_percent:  prediction.metrics?.packet_loss_pct      ?? prediction.metrics?.packet_loss  ?? 0,
          utilization_percent:  prediction.metrics?.utilization_pct      ?? prediction.metrics?.utilization  ?? 0,
          bgp_flaps:            prediction.metrics?.bgp_flaps            ?? 0,
        },
        network_condition:  prediction.network_condition  ?? '',
        prediction_reason:  prediction.prediction_reason  ?? [],
      },
    })
    .then((r) => r.data)

// ── POST /api/copilot ────────────────────────────────────────────────
// Full end-to-end: telemetry → ML → RAG → Phi-3
// Uses a longer timeout (150 s) because Phi-3 inference is slow offline.
export const copilot = (telemetry, question) =>
  client
    .post('/api/copilot', { telemetry, question }, { timeout: 150000 })
    .then((r) => r.data)

export default client
