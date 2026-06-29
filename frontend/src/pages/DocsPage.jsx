export default function DocsPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-noc-textPri">Documentation</h1>
        <p className="text-sm text-noc-textSec mt-1">ISRO Offline AI NOC Copilot — API Reference & Usage Guide</p>
      </div>

      {[
        {
          title: 'GET /health',
          method: 'GET',
          desc: 'Returns system health including ML engine status, ChromaDB collection info, and startup time.',
          body: null,
          response: `{ "status": "ok", "model": "phi3:mini", "collection": "noc_docs",\n  "total_chunks": 142, "prediction_engine": "Engine B (XGBoost + RF Regressor)",\n  "ml_model_loaded": true, "version": "2.0.0" }`,
        },
        {
          title: 'POST /api/predict',
          method: 'POST',
          desc: 'Runs Engine B (XGBoost) on raw telemetry. Returns risk level, confidence, TTI, metrics, and explainability.',
          body: `{ "site": "Branch-2", "device": "WAN-Edge-B2-01",\n  "latency_ms": 72.0, "packet_loss_pct": 4.0, "utilization_pct": 88.0,\n  "jitter_ms": 25.0, "queue_length": 220.0, "active_flows": 420.0,\n  "tunnel_uptime": 0.6, "throughput_mbps": 850.0,\n  "rx_bytes": 65000000, "tx_bytes": 58000000, "failure_category_enc": 1 }`,
          response: `{ "risk": "Critical", "confidence": 99, "confidence_score": 98.6,\n  "network_condition": "Failure", "time_to_impact": "2 minutes",\n  "prediction_reason": ["Packet loss at 4.0% exceeds threshold..."],\n  "model_version": "1.1.0", "prediction_latency_ms": 48.2 }`,
        },
        {
          title: 'POST /api/query',
          method: 'POST',
          desc: 'RAG-powered query. Provide a structured prediction + question. Returns a NOC incident report grounded in the knowledge base.',
          body: `{ "question": "What action should I take?",\n  "prediction": { "site": "Branch-2", "risk": "Critical",\n    "confidence": 99, "time_to_impact": "2 minutes",\n    "metrics": { "latency_ms": 72, "packet_loss_percent": 4.0,\n                 "utilization_percent": 88, "bgp_flaps": 5 } } }`,
          response: `{ "report": "INCIDENT REPORT\\n...", "sources": ["runbook_v2.pdf"],\n  "chunks_used": 4, "risk": "Critical", "confidence": 99 }`,
        },
        {
          title: 'POST /api/copilot',
          method: 'POST',
          desc: 'Full end-to-end pipeline. Runs ML prediction on telemetry, then feeds result into RAG. Returns combined prediction + incident report.',
          body: `{ "telemetry": { /* same as /api/predict */ },\n  "question": "Why is this site at risk?" }`,
          response: `{ "prediction": { ... }, "report": "...", "sources": [...],\n  "risk": "Critical", "confidence": 99 }`,
        },
      ].map(({ title, method, desc, body, response }) => (
        <div key={title} className="noc-card-glow space-y-3">
          <div className="flex items-center gap-3">
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded font-mono ${
              method === 'GET' ? 'bg-green-900/30 text-noc-green' : 'bg-blue-900/30 text-noc-cyan'
            }`}>{method}</span>
            <code className="font-mono text-noc-textPri font-semibold">{title}</code>
          </div>
          <p className="text-sm text-noc-textSec">{desc}</p>
          {body && (
            <>
              <p className="text-[10px] text-noc-textDim uppercase tracking-widest">Request Body</p>
              <pre className="bg-noc-bg rounded-lg p-3 text-xs font-mono text-noc-cyan overflow-x-auto border border-noc-border">{body}</pre>
            </>
          )}
          <p className="text-[10px] text-noc-textDim uppercase tracking-widest">Response</p>
          <pre className="bg-noc-bg rounded-lg p-3 text-xs font-mono text-noc-green overflow-x-auto border border-noc-border">{response}</pre>
        </div>
      ))}
    </div>
  )
}
