import { useState, useCallback } from 'react'

const MAX_HISTORY = 20

export function usePredictionHistory() {
  const [history, setHistory] = useState([])

  const add = useCallback((entry) => {
    setHistory((prev) => [
      {
        id:        Date.now(),
        timestamp: new Date().toLocaleTimeString('en-IN'),
        site:      entry.site      ?? '—',
        device:    entry.device    ?? '—',
        risk:      entry.risk      ?? '—',
        confidence:entry.confidence ?? 0,
        confidenceScore: entry.confidence_score ?? entry.confidence ?? 0,
        tti:       entry.time_to_impact ?? '—',
        condition: entry.network_condition ?? '—',
        latencyMs: entry.prediction_latency_ms ?? 0,
      },
      ...prev,
    ].slice(0, MAX_HISTORY))
  }, [])

  const clear = useCallback(() => setHistory([]), [])

  return { history, add, clear }
}
