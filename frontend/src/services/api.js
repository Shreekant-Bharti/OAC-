import axios from 'axios'

const client = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Unknown error'
    return Promise.reject(new Error(msg))
  }
)

export const getHealth = () => client.get('/health').then((r) => r.data)

export const predict = (telemetry) =>
  client.post('/api/predict', telemetry).then((r) => r.data)

export const query = (prediction, question) =>
  client
    .post('/api/query', {
      question,
      prediction: {
        site: prediction.site,
        risk: prediction.risk,
        confidence: prediction.confidence,
        time_to_impact: prediction.time_to_impact,
        metrics: {
          latency_ms: prediction.metrics?.latency_ms ?? prediction.metrics?.latency ?? 0,
          packet_loss_percent: prediction.metrics?.packet_loss_pct ?? prediction.metrics?.packet_loss ?? 0,
          utilization_percent: prediction.metrics?.utilization_pct ?? prediction.metrics?.utilization ?? 0,
          bgp_flaps: prediction.metrics?.bgp_flaps ?? 0,
        },
        network_condition: prediction.network_condition ?? '',
        prediction_reason: prediction.prediction_reason ?? [],
      },
    })
    .then((r) => r.data)

export const copilot = (telemetry, question) =>
  client.post('/api/copilot', { telemetry, question }, { timeout: 150000 }).then((r) => r.data)

export default client
