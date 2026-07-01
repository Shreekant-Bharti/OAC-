import { useEffect, useState, useMemo, useRef, memo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MdDeviceHub, MdWarning, MdTrendingUp, MdHub, MdStorage, MdAssessment, MdRadar,
} from 'react-icons/md'
import RiskCard             from '../components/dashboard/RiskCard'
import ConfidenceGauge      from '../components/dashboard/ConfidenceGauge'
import TimeToImpactCard     from '../components/dashboard/TimeToImpactCard'
import LatencyCard          from '../components/dashboard/LatencyCard'
import PredictionReasons    from '../components/dashboard/PredictionReasons'
import LiveTelemetryPanel, { NRF24Card } from '../components/dashboard/LiveTelemetryPanel'
import PredictionHistory    from '../components/dashboard/PredictionHistory'
import NocChatLog           from '../components/dashboard/NocChatLog'
import { LatencyChart, PacketLossChart, UtilizationChart } from '../components/charts/TelemetryCharts'
import NetworkTopology      from '../components/topology/NetworkTopology'
import { usePredict }          from '../hooks/usePredict'
import { useWebSocket }        from '../hooks/useWebSocket'
import { usePredictionHistory } from '../hooks/usePredictionHistory'
import { generateChartHistory } from '../utils/mockData'

const INITIAL_CHART_DATA = generateChartHistory(30)

// ── Memoised stat card ────────────────────────────────────────────────────────
const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, color, index, pulse }) {
  return (
    <motion.div
      className="noc-card flex items-center gap-3 py-3 px-4 relative overflow-hidden"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* subtle corner accent */}
      <div
        className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-10 pointer-events-none"
        style={{ background: color }}
      />
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}35` }}
      >
        <Icon style={{ color, fontSize: 20 }} />
        {pulse && (
          <span
            className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: color }}
          />
        )}
      </div>
      <div className="min-w-0">
        <AnimatePresence mode="popLayout">
          <motion.p
            key={value}
            className="font-bold text-lg leading-none text-noc-textPri truncate"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
          >
            {value}
          </motion.p>
        </AnimatePresence>
        <p className="text-[10px] text-noc-textDim mt-1 uppercase tracking-wider truncate">{label}</p>
        <p className="text-[9px] mt-0.5 truncate" style={{ color }}>{sub}</p>
      </div>
    </motion.div>
  )
})

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, right, pulse }) {
  return (
    <div className="flex items-center justify-between flex-shrink-0 pb-2 mb-2 border-b border-noc-border/40">
      <div className="flex items-center gap-2">
        <Icon className="text-noc-cyan text-sm flex-shrink-0" />
        <span className="section-title mb-0">{title}</span>
        {pulse && (
          <span className="flex items-center gap-1 text-[9px] text-noc-textDim ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-noc-cyan animate-pulse" />
            Live
          </span>
        )}
      </div>
      {right}
    </div>
  )
}

// ── Topology zoom/pan controls ────────────────────────────────────────────────
function TopoControls({ onZoomIn, onZoomOut, onFit, onReset, scale }) {
  const btn = "w-7 h-7 rounded border border-noc-border/60 bg-noc-surface/80 text-noc-textSec hover:text-noc-cyan hover:border-noc-cyan/40 flex items-center justify-center text-xs transition-all backdrop-blur-sm"
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-noc-textDim font-mono">{Math.round(scale * 100)}%</span>
      <button className={btn} onClick={onZoomIn}  title="Zoom In">+</button>
      <button className={btn} onClick={onZoomOut} title="Zoom Out">−</button>
      <button className={btn} onClick={onFit}     title="Fit View" style={{ fontSize: 9 }}>FIT</button>
      <button className={btn} onClick={onReset}   title="Reset"    style={{ fontSize: 9 }}>RST</button>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  // ── Single source of truth ───────────────────────────────────────────────
  const { telemetry, deviceInfo, wsStatus, wsUrl, lastUpdated, error } = useWebSocket()
  const { result, run } = usePredict()
  const { history, add } = usePredictionHistory()
  const [chartData, setChartData] = useState(INITIAL_CHART_DATA)

  // topology pan/zoom state
  const [topoScale, setTopoScale]     = useState(1)
  const [topoPan,   setTopoPan]       = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging]   = useState(false)
  const dragStart = useRef(null)
  const topoWrapRef = useRef(null)

  // ── Prediction trigger (one per unique timestamp) ────────────────────────
  const lastPredTimestamp = useRef(null)
  useEffect(() => {
    if (!telemetry) return
    const ts = telemetry.timestamp ?? String(telemetry.tunnel_uptime)
    if (ts === lastPredTimestamp.current) return
    lastPredTimestamp.current = ts
    run({
      site:                 telemetry.site               ?? 'Unknown',
      device:               telemetry.interface          ?? 'ESP32-WAN',
      latency_ms:           parseFloat(telemetry.latency_ms         ?? 0),
      packet_loss_pct:      parseFloat(telemetry.packet_loss_pct    ?? 0),
      utilization_pct:      parseFloat(telemetry.utilization_pct    ?? 0),
      jitter_ms:            parseFloat(telemetry.jitter_ms          ?? 0),
      queue_length:         parseFloat(telemetry.queue_length       ?? 0),
      active_flows:         parseFloat(telemetry.active_flows       ?? 0),
      tunnel_uptime:        parseFloat(telemetry.tunnel_uptime      ?? 1.0),
      throughput_mbps:      parseFloat(telemetry.throughput_mbps    ?? 0),
      rx_bytes:             parseInt(telemetry.rx_bytes             ?? 0),
      tx_bytes:             parseInt(telemetry.tx_bytes             ?? 0),
      bgp_flaps:            parseInt(telemetry.bgp_flaps            ?? 0),
      ospf_events:          parseInt(telemetry.ospf_events          ?? 0),
      tunnel_health:        parseFloat(telemetry.tunnel_health      ?? 1.0),
      failure_category_enc: parseInt(telemetry.failure_category_enc ?? 0),
    }, { silent: true })
  }, [telemetry, run])

  // ── Chart update whenever prediction lands ───────────────────────────────
  useEffect(() => {
    if (!result) return
    add(result)
    setChartData(prev => {
      const label = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      return {
        labels:      [...prev.labels.slice(1),      label],
        latency:     [...prev.latency.slice(1),      result.metrics?.latency_ms       ?? result.metrics?.latency      ?? 0],
        packetLoss:  [...prev.packetLoss.slice(1),   result.metrics?.packet_loss_pct  ?? result.metrics?.packet_loss  ?? 0],
        utilization: [...prev.utilization.slice(1),  result.metrics?.utilization_pct  ?? result.metrics?.utilization  ?? 0],
        jitter:      [...prev.jitter.slice(1),       result.metrics?.jitter_ms        ?? result.metrics?.jitter       ?? 0],
        confidence:  [...prev.confidence.slice(1),   result.confidence_score          ?? result.confidence            ?? 0],
      }
    })
  }, [result, add])

  // ── Live stat cards — 5 cards, all values from real telemetry/prediction ─
  const statCards = useMemo(() => {
    const lat    = parseFloat(telemetry?.latency_ms      ?? 0)
    const loss   = parseFloat(telemetry?.packet_loss_pct ?? 0)
    const util   = parseFloat(telemetry?.utilization_pct ?? 0)
    const jitter = parseFloat(telemetry?.jitter_ms       ?? 0)

    // ── CARD 1: Total Nodes
    // Fixed topology: Hub + DC + Branch A + Branch B + Branch C = 5
    const TOTAL_NODES = 5
    const onlineNodes = wsStatus === 'connected' ? TOTAL_NODES : '?'

    // ── CARD 2: Active Alerts
    // Starts at 0. Each threshold breach adds 1. Never uses MOCK_ALERTS.
    let activeAlerts = 0
    if (telemetry) {
      // Warning-level thresholds
      if (lat  >= 40 && lat  < 60)  activeAlerts += 1
      if (loss >= 1  && loss < 5)   activeAlerts += 1
      if (util >= 70 && util < 85)  activeAlerts += 1
      if (jitter >= 20 && jitter < 30) activeAlerts += 1
      // Critical-level thresholds (count as alert too)
      if (lat  >= 60)  activeAlerts += 1
      if (loss >= 5)   activeAlerts += 1
      if (util >= 85)  activeAlerts += 1
      if (jitter >= 30) activeAlerts += 1
    }
    // ML prediction-level alert
    if (result?.risk) {
      const r = result.risk.toLowerCase()
      if (r === 'critical' || r === 'high') activeAlerts += 1
    }
    const alertSub = activeAlerts === 0
      ? 'All nodes healthy'
      : activeAlerts === 1
      ? '1 threshold breach'
      : `${activeAlerts} threshold breaches`

    // ── CARD 3: Predicted Risks (ML only)
    const predRisk = result?.risk ?? null
    const predRiskValue = predRisk ?? 'No Prediction'
    const predRiskSub   = predRisk
      ? (result?.network_condition ?? 'ML Engine B')
      : 'Awaiting first cycle'

    // ── CARD 4: Network Health
    // 100% when no telemetry issues. Degrades with thresholds.
    let health = 100
    if (!telemetry) {
      health = wsStatus === 'connected' ? 95 : 70  // connected but no frame yet → 95; offline → 70
    } else {
      // Deduct per warning/critical metric
      if (lat  >= 40  && lat  < 60)  health -= 5
      if (lat  >= 60)                 health -= 15
      if (loss >= 1   && loss < 5)    health -= 5
      if (loss >= 5)                  health -= 15
      if (util >= 70  && util < 85)   health -= 5
      if (util >= 85)                 health -= 10
      if (jitter >= 20 && jitter < 30) health -= 3
      if (jitter >= 30)               health -= 8
      health = Math.max(0, Math.min(100, health))
    }
    const healthColor = health >= 90 ? '#00e676' : health >= 75 ? '#ffd700' : '#ff3b3b'
    const healthSub   = telemetry?.sla_status
      ? `SLA: ${telemetry.sla_status}`
      : health === 100 ? 'All systems nominal'
      : health >= 75   ? 'Degraded — check alerts'
      : 'Critical — immediate action'

    // ── CARD 5: Data Ingestion
    // Shows real connection state, never a byte count unless truly connected.
    const rxBytes    = parseInt(telemetry?.rx_bytes ?? 0)
    const txBytes    = parseInt(telemetry?.tx_bytes ?? 0)
    const totalBytes = rxBytes + txBytes
    let dataValue, dataSub, dataColor
    if (wsStatus === 'connected' && telemetry) {
      // Show volume only when actually receiving data
      dataValue = totalBytes >= 1e6 ? `${(totalBytes / 1e6).toFixed(1)} MB`
                : totalBytes >= 1e3 ? `${(totalBytes / 1e3).toFixed(0)} KB`
                : `${totalBytes} B`
      dataSub   = 'Receiving · 8s poll'
      dataColor = '#00e676'
    } else if (wsStatus === 'connecting' || (wsStatus === 'connected' && !telemetry)) {
      dataValue = 'Polling'
      dataSub   = 'Waiting for ESP32 frame'
      dataColor = '#ffd700'
    } else {
      dataValue = 'Disconnected'
      dataSub   = 'ESP32 unreachable'
      dataColor = '#3d567a'
    }

    return [
      {
        icon: MdDeviceHub, label: 'Total Nodes',
        value: String(TOTAL_NODES),
        sub: `${onlineNodes} Online · All Sites`,
        color: '#00d4ff',
        pulse: wsStatus === 'connected',
      },
      {
        icon: MdWarning, label: 'Active Alerts',
        value: String(activeAlerts),
        sub: alertSub,
        color: activeAlerts === 0 ? '#00e676' : activeAlerts >= 3 ? '#ff3b3b' : '#ff8c00',
        pulse: activeAlerts > 0,
      },
      {
        icon: MdTrendingUp, label: 'Predicted Risks',
        value: predRiskValue,
        sub: predRiskSub,
        color: predRisk
          ? (predRisk.toLowerCase() === 'critical' ? '#ff3b3b'
            : predRisk.toLowerCase() === 'high'     ? '#ff8c00'
            : predRisk.toLowerCase() === 'medium'   ? '#ffd700'
            : '#00e676')
          : '#3d567a',
        pulse: !!predRisk,
      },
      {
        icon: MdHub, label: 'Network Health',
        value: `${health}%`,
        sub: healthSub,
        color: healthColor,
        pulse: !!telemetry,
      },
      {
        icon: MdStorage, label: 'Data Ingestion',
        value: dataValue,
        sub: dataSub,
        color: dataColor,
        pulse: wsStatus === 'connected' && !!telemetry,
      },
    ]
  }, [telemetry, result, wsStatus])

  // ── Topology pan/zoom handlers ───────────────────────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    setTopoScale(s => Math.min(3, Math.max(0.3, s - e.deltaY * 0.001)))
  }, [])

  const handleMouseDown = useCallback((e) => {
    setIsDragging(true)
    dragStart.current = { x: e.clientX - topoPan.x, y: e.clientY - topoPan.y }
  }, [topoPan])

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart.current) return
    setTopoPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }, [isDragging])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  const zoomIn  = useCallback(() => setTopoScale(s => Math.min(3, s + 0.15)), [])
  const zoomOut = useCallback(() => setTopoScale(s => Math.max(0.3, s - 0.15)), [])
  const fitView = useCallback(() => { setTopoScale(1); setTopoPan({ x: 0, y: 0 }) }, [])
  const resetView = useCallback(() => { setTopoScale(1); setTopoPan({ x: 0, y: 0 }) }, [])

  const statusDots = (
    <div className="flex items-center gap-3 text-[10px] text-noc-textSec font-mono">
      <Dot color="bg-noc-green"  label="Online"   />
      <Dot color="bg-noc-yellow" label="Warning"  />
      <Dot color="bg-noc-red"    label="Critical" />
    </div>
  )

  return (
    <div className="p-3 flex flex-col gap-3 min-h-0 max-w-[2000px] mx-auto w-full">

      {/* ══ Row 1: 5-Card Stat Bar ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 flex-shrink-0">
        {statCards.map((c, i) => (
          <StatCard key={c.label} index={i} {...c} />
        ))}
      </div>

      {/* ══ Row 2: Topology (left-centre) + Telemetry (right) ══════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 flex-shrink-0">

        {/* Topology — 8 columns wide */}
        <div className="xl:col-span-8 noc-card flex flex-col" style={{ height: 460 }}>
          <SectionHeader
            icon={MdRadar}
            title="Live Network Topology"
            pulse={wsStatus === 'connected'}
            right={
              <div className="flex items-center gap-4">
                {statusDots}
                <TopoControls
                  onZoomIn={zoomIn} onZoomOut={zoomOut}
                  onFit={fitView}   onReset={resetView}
                  scale={topoScale}
                />
              </div>
            }
          />
          {/* Pan/zoom wrapper */}
          <div
            ref={topoWrapRef}
            className="flex-1 overflow-hidden relative"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              style={{
                width: '100%', height: '100%',
                transform: `translate(${topoPan.x}px,${topoPan.y}px) scale(${topoScale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
            >
              <NetworkTopology
                predResult={result}
                liveTelemetry={telemetry}
                deviceInfo={deviceInfo}
              />
            </div>
          </div>
        </div>

        {/* Live Telemetry — 4 columns wide */}
        <div className="xl:col-span-4 flex flex-col gap-3 min-h-0" style={{ height: 460 }}>
          <div className="flex-1 overflow-hidden">
            <LiveTelemetryPanel
              telemetry={telemetry}
              deviceInfo={deviceInfo}
              wsStatus={wsStatus}
              wsUrl={wsUrl}
              lastUpdated={lastUpdated}
              error={error}
            />
          </div>
        </div>
      </div>

      {/* ══ Row 3: AI Engine (full-width) ══════════════════════════════════ */}
      <div className="noc-card flex-shrink-0">
        <SectionHeader
          icon={MdAssessment}
          title="AI Prediction Engine"
          pulse={!!result}
          right={
            <span className="text-[9px] text-noc-textDim font-mono">
              Engine B · XGBoost + RF
            </span>
          }
        />
        {/* 4-metric row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <RiskCard        risk={result?.risk}          condition={result?.network_condition} loading={false} />
          <ConfidenceGauge confidence={result?.confidence} confidenceScore={result?.confidence_score} loading={false} />
          <TimeToImpactCard tti={result?.time_to_impact} ttiMinutes={result?.time_to_impact_minutes} loading={false} />
          <LatencyCard     predictionLatencyMs={result?.prediction_latency_ms} featureMapMs={result?.feature_map_ms} inferenceMs={result?.inference_ms} loading={false} />
        </div>

        {/* Reasons + NRF24 row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 border-t border-noc-border/40 pt-3">
          <div className="lg:col-span-2">
            {result?.prediction_reason?.length > 0
              ? <PredictionReasons reasons={result.prediction_reason} loading={false} />
              : <div className="flex items-center justify-center h-16 text-[11px] text-noc-textDim">
                  Awaiting first telemetry cycle…
                </div>
            }
          </div>
          {deviceInfo?.nrf24_link && (
            <NRF24Card nrf={deviceInfo.nrf24_link} />
          )}
        </div>
      </div>

      {/* ══ Row 4: Charts + History + Chat ════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 flex-shrink-0">

        {/* Charts — 8 cols */}
        <div className="xl:col-span-8 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <LatencyChart     data={chartData} />
            <PacketLossChart  data={chartData} />
            <UtilizationChart data={chartData} />
          </div>

          {/* Prediction History */}
          <div className="noc-card">
            <SectionHeader
              icon={MdAssessment}
              title="Prediction History"
              right={
                <span className="text-[9px] text-noc-textDim font-mono">
                  {history.length} record{history.length !== 1 ? 's' : ''}
                </span>
              }
            />
            <PredictionHistory history={history} />
          </div>
        </div>

        {/* Chat Log — 4 cols */}
        <div className="xl:col-span-4">
          <NocChatLog deviceInfo={deviceInfo} maxHeight={440} />
        </div>
      </div>

    </div>
  )
}

function Dot({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  )
}
