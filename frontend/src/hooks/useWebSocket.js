import { useState, useEffect, useRef } from 'react'

// Hardware endpoint — routed through Vite proxy (/esp32 → ngrok tunnel) to avoid CORS.
const NETWORK_URL   = '/esp32/network'
const POLL_INTERVAL = 8000   // 8 s — matches ESP32 telemetry cadence
const FETCH_TIMEOUT = 5000   // 5 s per request

/* Map chat-style IDs to friendly site names */
const SENDER_MAP = {
  b1: 'Branch A',
  b2: 'Branch B',
  b3: 'Branch C',
  dc: 'DataCentre',
}

function resolveSiteFromChat(lastSent) {
  if (!lastSent) return null
  const m = lastSent.match(/^\[([A-Z0-9]+)\s+to/i)
  if (!m) return null
  return SENDER_MAP[m[1].toLowerCase()] ?? null
}

/**
 * useWebSocket (HTTP polling façade)
 *
 * Polls GET /esp32/network (proxied via Vite → https://clock-manicure-unshipped.ngrok-free.dev/network) every 8 seconds.
 * Automatically overrides telemetry.site from chat.last_sent sender ID
 * (e.g. "[B1 to B2]" → site = "Branch A").
 *
 * Returns:
 *   telemetry   – telemetry sub-object with `.site` overridden when possible
 *   deviceInfo  – full raw JSON (esp32, nodemcu, nrf24_link, chat, telemetry)
 *   wsStatus    – 'connecting' | 'connected' | 'error'
 *   wsUrl       – polling URL
 *   lastUpdated – Date of last successful fetch
 *   error       – last error message or null
 */
export function useWebSocket() {
  const [telemetry,   setTelemetry]   = useState(null)
  const [deviceInfo,  setDeviceInfo]  = useState(null)
  const [status,      setStatus]      = useState('connecting')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error,       setError]       = useState(null)

  const mountedRef = useRef(true)
  const timerRef   = useRef(null)
  const abortRef   = useRef(null)

  const fetchNow = async () => {
    if (!mountedRef.current) return

    if (abortRef.current) {
      try { abortRef.current.abort() } catch (_) { }
    }
    const controller = new AbortController()
    abortRef.current = controller

    // Apply a fetch timeout via AbortController
    const timeoutId = setTimeout(() => { try { controller.abort() } catch (_) { } }, FETCH_TIMEOUT)

    try {
      const res = await fetch(NETWORK_URL, {
        signal: controller.signal,
        cache:  'no-store',
        headers: { Accept: 'application/json' },
      })
      clearTimeout(timeoutId)

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      if (!mountedRef.current) return

      // Extract the telemetry sub-object
      const rawTele = json?.telemetry ?? null

      // Override telemetry.site from chat sender ID when available
      let tele = rawTele
      if (tele) {
        const chatSite = resolveSiteFromChat(json?.chat?.last_sent)
        tele = {
          ...tele,
          site: chatSite ?? tele.site ?? 'ESP32-MASTER',
        }
      }

      setTelemetry(tele)
      setDeviceInfo(json)           // full payload — chat, esp32, nodemcu, nrf24_link all here
      setStatus('connected')
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      clearTimeout(timeoutId)
      if (!mountedRef.current) return
      if (err.name === 'AbortError') return

      setStatus('error')
      setError(err.message ?? 'Fetch failed')
    }
  }

  useEffect(() => {
    mountedRef.current = true
    fetchNow()
    timerRef.current = setInterval(fetchNow, POLL_INTERVAL)

    return () => {
      mountedRef.current = false
      clearInterval(timerRef.current)
      if (abortRef.current) {
        try { abortRef.current.abort() } catch (_) { }
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    telemetry,
    deviceInfo,
    wsStatus: status,
    wsUrl:    NETWORK_URL,
    lastUpdated,
    error,
  }
}
