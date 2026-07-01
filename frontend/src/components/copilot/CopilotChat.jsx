import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MdSend, MdSmartToy, MdPerson, MdContentCopy, MdDelete, MdRefresh, MdAccessTime } from 'react-icons/md'
import { copilot as apiCopilot } from '../../services/api'
import { TOPOLOGY_NODES_INIT, DEFAULT_TELEMETRY } from '../../utils/mockData'
import toast from 'react-hot-toast'

// Site names derived from the same topology source as the Dashboard.
// If Dashboard discovers new nodes, they automatically appear here.
const LIVE_SITES = TOPOLOGY_NODES_INIT.map(n => n.label)

const SUGGESTIONS = [
  'Why is this site at high risk?',
  'What immediate action should I take?',
  'Is there a runbook for this alert?',
  'What is the correct escalation path?',
  'How does this compare to historical incidents?',
]

const PROGRESS_STATES = [
  'Analyzing network telemetry...',
  'Running ML prediction engine...',
  'Searching incident database...',
  'Generating AI recommendation...',
  'Finalizing report...',
]

function ProgressIndicator() {
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1)
      setStep((prev) => (prev < PROGRESS_STATES.length - 1 ? prev + (prev === 0 ? 0.3 : 0.05) : prev))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const currentStep = Math.min(Math.floor(step), PROGRESS_STATES.length - 1)

  return (
    <div className="flex flex-col gap-2 min-w-[200px]">
      <div className="flex items-center justify-between text-[11px] text-noc-cyan mb-1">
        <span className="font-medium">{PROGRESS_STATES[currentStep]}</span>
        <span className="font-mono bg-noc-cyan/10 px-1.5 py-0.5 rounded flex items-center gap-1">
          <MdAccessTime /> {elapsed}s
        </span>
      </div>
      <div className="h-1 bg-noc-border rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-noc-cyan"
          initial={{ width: '0%' }}
          animate={{ width: `${((currentStep + 1) / PROGRESS_STATES.length) * 100}%` }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

function MessageBubble({ msg, onRetry }) {
  const isUser = msg.role === 'user'

  const copyReport = () => {
    if (msg.content) {
      navigator.clipboard.writeText(msg.content)
      toast.success('Copied to clipboard')
    }
  }

  return (
    <motion.div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${isUser
          ? 'bg-blue-600/20 text-blue-400'
          : 'bg-noc-cyan/15 text-noc-cyan'
        }`}>
        {isUser ? <MdPerson className="text-base" /> : <MdSmartToy className="text-base" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        <div className={`px-4 py-3 rounded-md text-sm leading-relaxed shadow-sm ${isUser
            ? 'bg-blue-600/10 border border-blue-600/20 text-noc-textPri'
            : msg.error
              ? 'bg-red-900/10 border border-red-700/30 text-noc-red'
              : 'bg-noc-card border border-noc-border text-noc-textPri'
          }`}>
          {msg.loading ? (
            <ProgressIndicator />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
          )}
        </div>

        {/* Metadata row */}
        {!isUser && !msg.loading && !msg.error && (
          <div className="flex items-center gap-3 px-1 w-full mt-1 border-t border-noc-border/30 pt-2">
            {msg.risk && (
              <span className="text-[10px] text-noc-textDim uppercase tracking-wide">
                Risk: <span className="text-noc-orange font-semibold ml-1">{msg.risk}</span>
              </span>
            )}
            {msg.confidence !== undefined && (
              <span className="text-[10px] text-noc-textDim uppercase tracking-wide">
                Conf: <span className="text-noc-cyan font-mono ml-1">{msg.confidence.toFixed(1)}%</span>
              </span>
            )}
            {msg.sources?.length > 0 && (
              <span className="text-[10px] text-noc-textDim uppercase tracking-wide">
                Sources: <span className="text-noc-textSec font-mono ml-1">{msg.sources.length}</span>
              </span>
            )}
            <button
              onClick={copyReport}
              className="ml-auto text-noc-textDim hover:text-noc-cyan transition-colors"
              title="Copy to clipboard"
            >
              <MdContentCopy className="text-sm" />
            </button>
          </div>
        )}

        {/* Error actions */}
        {!isUser && msg.error && onRetry && (
          <button
            onClick={() => onRetry(msg.originalQuestion)}
            className="flex items-center gap-1.5 text-[11px] text-noc-red hover:text-red-400 bg-red-900/20 px-3 py-1.5 rounded-sm transition-colors mt-1 border border-red-900/50"
          >
            <MdRefresh /> Retry Request
          </button>
        )}

        <p className="text-[9px] text-noc-textDim px-1 uppercase tracking-wider">{msg.time}</p>
      </div>
    </motion.div>
  )
}

// Selected site name sanitization helper to map site keys to LIVE_SITES labels
function sanitizeSiteName(name) {
  if (!name) return 'Branch B'
  const lower = name.toLowerCase()
  if (lower.includes('branch a') || lower.includes('branch-1') || lower.includes('br-a') || lower === 'b1') return 'Branch A'
  if (lower.includes('branch b') || lower.includes('branch-2') || lower.includes('br-b') || lower === 'b2') return 'Branch B'
  if (lower.includes('branch c') || lower.includes('branch-3') || lower.includes('br-c') || lower === 'b3') return 'Branch C'
  if (lower.includes('datacentre') || lower.includes('dc') || lower.includes('data centre')) return 'DataCentre'
  if (lower.includes('hub') || lower.includes('intelligent hub')) return 'Intelligent Hub'
  return 'Branch B'
}

/**
 * CopilotChat
 *
 * liveTelemetry — live ESP32 telemetry object from useWebSocket(), passed by AICopilotPage.
 * All metric fields are auto-populated from live hardware data.
 * Only the Site selector allows user override; all other values are read-only.
 */
export default function CopilotChat({ liveTelemetry = null }) {
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: 'assistant',
      content: 'NOC Copilot ready. I can analyze network telemetry, explain predictions, and provide remediation guidance.\n\nLive ESP32 telemetry is auto-loaded from hardware. Select a site below to focus analysis.',
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // selectedSite: null = follow live hardware site; any string = user override
  const [selectedSite, setSelectedSite] = useState(null)
  const containerRef = useRef(null)

  // Initialize selectedSite from live data on first successful fetch
  useEffect(() => {
    if (liveTelemetry?.site && selectedSite === null) {
      setSelectedSite(sanitizeSiteName(liveTelemetry.site))
    }
  }, [liveTelemetry, selectedSite])

  // Effective telemetry = live values + user's site selection.
  // Properly cast and mapped to strictly match backend's TelemetryInput validation schema.
  const effectiveTelemetry = useMemo(() => {
    const source = liveTelemetry ?? DEFAULT_TELEMETRY
    return {
      site: selectedSite ?? sanitizeSiteName(source.site),
      device: source.interface ?? source.device ?? 'ESP32-WAN',
      latency_ms: parseFloat(source.latency_ms ?? 0),
      packet_loss_pct: parseFloat(source.packet_loss_pct ?? 0),
      utilization_pct: parseFloat(source.utilization_pct ?? 0),
      jitter_ms: parseFloat(source.jitter_ms ?? 0),
      cpu_pct: parseFloat(source.cpu_pct ?? 0),
      memory_pct: parseFloat(source.memory_pct ?? 0),
      bgp_flaps: parseInt(source.bgp_flaps ?? 0),
      ospf_events: parseInt(source.ospf_events ?? 0),
      tunnel_health: parseFloat(source.tunnel_health ?? 1.0),
      interface_errors: parseInt(source.interface_errors ?? 0),
      queue_length: parseFloat(source.queue_length ?? 0),
      active_flows: parseFloat(source.active_flows ?? 0),
      tunnel_uptime: 0, // Hardcoded permanent 0 for now
      throughput_mbps: parseFloat(source.throughput_mbps ?? 0),
      rx_bytes: parseInt(source.rx_bytes ?? 0),
      tx_bytes: parseInt(source.tx_bytes ?? 0),
      failure_category_enc: parseInt(source.failure_category_enc ?? 0),
    }
  }, [liveTelemetry, selectedSite])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const send = useCallback(async (question) => {
    if (!question.trim() || loading) return
    const q = question.trim()
    setInput('')

    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: q,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }
    const loadingMsg = {
      id: Date.now() + 1,
      role: 'assistant',
      loading: true,
      time: '',
    }

    setMessages(prev => [...prev.filter(m => !m.error), userMsg, loadingMsg])
    setLoading(true)

    try {
      console.log('--- NOC COPILOT API REQUEST ---')
      console.log('Selected Site:', effectiveTelemetry.site)
      console.log('Telemetry payload:', effectiveTelemetry)
      console.log('User question:', q)

      const res = await apiCopilot(effectiveTelemetry, q)

      console.log('--- NOC COPILOT API RESPONSE ---')
      console.log('Raw response:', res)

      const assistantMsg = {
        id: Date.now() + 2,
        role: 'assistant',
        content: res.report,
        risk: res.risk,
        confidence: res.confidence_score !== undefined ? res.confidence_score : res.confidence,
        tti: res.time_to_impact,
        sources: res.sources,
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      }

      console.log('Parsed response / Final rendered message:', assistantMsg)

      setMessages(prev => [...prev.slice(0, -1), assistantMsg])
    } catch (e) {
      console.error('--- NOC COPILOT API ERROR ---')
      console.error(e)

      let friendlyError = e.message
      if (friendlyError.includes('timeout')) {
        friendlyError = 'Request timed out. The local ML model took too long to respond. Please try again.'
      } else if (friendlyError.includes('Network Error')) {
        friendlyError = 'Backend offline. Please ensure the server is running on port 8000.'
      }

      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          id: Date.now() + 2,
          role: 'assistant',
          error: true,
          originalQuestion: q,
          content: friendlyError,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [loading, effectiveTelemetry])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  // Helper to format a metric value for display
  const fmt = (val, decimals = 2) =>
    val !== undefined && val !== null ? Number(val).toFixed(decimals) : '—'

  const isLive = !!liveTelemetry

  return (
    <div className="flex h-full gap-4 p-4 bg-noc-bgPri">
      {/* Left — Live Site Telemetry panel */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="bg-noc-card border border-noc-border flex flex-col gap-4 flex-1 overflow-y-auto p-4 rounded-sm shadow-sm">

          {/* Header with live indicator */}
          <div className="flex items-center justify-between border-b border-noc-border pb-2">
            <p className="text-xs font-bold text-noc-textPri tracking-wide uppercase">Site Telemetry</p>
            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-medium"
              style={{ color: isLive ? 'var(--noc-green, #00e676)' : 'var(--noc-red, #ff5252)' }}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'animate-pulse' : ''}`}
                style={{ background: isLive ? 'var(--noc-green, #00e676)' : 'var(--noc-red, #ff5252)' }} />
              {isLive ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Site selector — only editable field */}
          <div>
            <label className="text-[10px] uppercase tracking-wide font-semibold text-noc-textDim mb-1 block">Site</label>
            <select
              className="noc-input w-full"
              value={selectedSite ?? ''}
              onChange={e => setSelectedSite(e.target.value)}
            >
              {LIVE_SITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Read-only live metric rows */}
          <div className="space-y-2.5">
            {[
              ['Latency (ms)',     fmt(effectiveTelemetry.latency_ms,      2)],
              ['Packet Loss (%)',  fmt(effectiveTelemetry.packet_loss_pct, 2)],
              ['Utilization (%)', fmt(effectiveTelemetry.utilization_pct, 1)],
              ['Jitter (ms)',      fmt(effectiveTelemetry.jitter_ms,       2)],
              ['Tunnel Uptime',   fmt(effectiveTelemetry.tunnel_uptime,   2)],
              ['Queue Length',    fmt(effectiveTelemetry.queue_length,    0)],
              ['Throughput Mbps', fmt(effectiveTelemetry.throughput_mbps, 1)],
              ['Active Flows',    fmt(effectiveTelemetry.active_flows,    0)],
              ['RX Bytes',        fmt(effectiveTelemetry.rx_bytes,        0)],
              ['TX Bytes',        fmt(effectiveTelemetry.tx_bytes,        0)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-1 border-b border-noc-border/30 last:border-0">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-noc-textDim">{label}</span>
                <span className={`font-mono text-sm ${isLive ? 'text-noc-textPri' : 'text-noc-textDim'}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Last updated timestamp */}
          {isLive && (
            <p className="text-[9px] text-noc-textDim text-center pt-1 border-t border-noc-border/30 uppercase tracking-wider">
              Auto-updates every 8 s
            </p>
          )}
        </div>
      </div>

      {/* Right — Chat (unchanged) */}
      <div className="flex-1 flex flex-col bg-noc-card border border-noc-border rounded-sm shadow-sm overflow-hidden relative">
        {loading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-noc-bgPri overflow-hidden z-10">
            <motion.div
              className="h-full bg-noc-cyan/50"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-noc-border bg-noc-bgPri/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-900/20 border border-blue-500/30 flex items-center justify-center">
              <MdSmartToy className="text-blue-400 text-lg" />
            </div>
            <div>
              <p className="text-sm font-semibold text-noc-textPri tracking-wide">AI NOC Copilot</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-noc-green shadow-[0_0_8px_rgba(0,230,118,0.6)]" />
                <span className="text-[10px] text-noc-textSec uppercase tracking-wider font-medium">Phi-3 LLM · Active</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setMessages(prev => [prev[0]])}
            className="p-1.5 text-noc-textDim hover:text-noc-textPri hover:bg-noc-border/40 transition-colors rounded"
            title="Clear chat"
          >
            <MdDelete className="text-base" />
          </button>
        </div>

        {/* Messages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto space-y-5 p-4">
          <AnimatePresence>
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} onRetry={send} />)}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="p-4 bg-noc-bgPri/50 border-t border-noc-border">
          {/* Suggestions */}
          <div className="flex gap-2 flex-wrap mb-3">
            {SUGGESTIONS.slice(0, 3).map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={loading}
                className="text-[10px] font-medium tracking-wide text-noc-textSec border border-noc-border/80 hover:bg-noc-border/40 hover:text-noc-textPri px-3 py-1.5 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-noc-card"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex gap-3">
            <textarea
              className="noc-input flex-1 resize-none py-3 text-sm focus:border-noc-cyan/50"
              rows={2}
              placeholder="Ask about network conditions, alerts, or recommended actions…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 disabled:text-blue-200/30 text-white px-5 rounded-sm transition-colors flex items-center justify-center border border-blue-500/50"
            >
              <MdSend className="text-lg" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
