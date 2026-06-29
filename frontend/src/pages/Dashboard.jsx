import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MdDeviceHub, MdWarning, MdTrendingUp, MdHub, MdStorage, MdNotifications } from 'react-icons/md'
import RiskCard from '../components/dashboard/RiskCard'
import ConfidenceGauge from '../components/dashboard/ConfidenceGauge'
import TimeToImpactCard from '../components/dashboard/TimeToImpactCard'
import LatencyCard from '../components/dashboard/LatencyCard'
import MetricsPanel from '../components/dashboard/MetricsPanel'
import PredictionReasons from '../components/dashboard/PredictionReasons'
import PredictionForm from '../components/dashboard/PredictionForm'
import PredictionHistory from '../components/dashboard/PredictionHistory'
import { LatencyChart, PacketLossChart, UtilizationChart, ConfidenceTimeline } from '../components/charts/TelemetryCharts'
import NetworkTopology from '../components/topology/NetworkTopology'
import { usePredict } from '../hooks/usePredict'
import { usePredictionHistory } from '../hooks/usePredictionHistory'
import { MOCK_ALERTS, generateChartHistory } from '../utils/mockData'
import { riskColor } from '../utils/formatters'

const STAT_CARDS = [
  { icon: MdDeviceHub,   label: 'Total Nodes',     value: '5',     sub: 'All Sites Online',  color: '#00d4ff' },
  { icon: MdWarning,     label: 'Active Alerts',   value: '2',     sub: 'High Priority',     color: '#ff3b3b' },
  { icon: MdTrendingUp,  label: 'Predicted Risks', value: '3',     sub: 'Next 30 Minutes',   color: '#ff8c00' },
  { icon: MdHub,         label: 'Network Health',  value: '92%',   sub: 'Healthy',           color: '#00e676' },
  { icon: MdStorage,     label: 'Data Ingestion',  value: '1.2K/s',sub: 'Telemetry Rate',   color: '#6c63ff' },
]

const INITIAL_CHART_DATA = generateChartHistory(30)

export default function Dashboard() {
  const { result, loading, run } = usePredict()
  const { history, add } = usePredictionHistory()
  const [chartData, setChartData] = useState(INITIAL_CHART_DATA)

  useEffect(() => {
    if (result) {
      add(result)
      
      // Update chart data dynamically
      setChartData(prev => {
        const timeLabel = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        
        return {
          labels: [...prev.labels.slice(1), timeLabel],
          latency: [...prev.latency.slice(1), result.metrics?.latency_ms ?? result.metrics?.latency ?? 0],
          packetLoss: [...prev.packetLoss.slice(1), result.metrics?.packet_loss_pct ?? result.metrics?.packet_loss ?? 0],
          utilization: [...prev.utilization.slice(1), result.metrics?.utilization_pct ?? result.metrics?.utilization ?? 0],
          jitter: [...prev.jitter.slice(1), result.metrics?.jitter_ms ?? result.metrics?.jitter ?? 0],
          confidence: [...prev.confidence.slice(1), result.confidence_score ?? result.confidence ?? 0]
        }
      })
    }
  }, [result, add])

  return (
    <div className="p-4 space-y-4">

      {/* ── Top stat bar ── */}
      <div className="grid grid-cols-5 gap-3">
        {STAT_CARDS.map((c, i) => (
          <motion.div
            key={c.label}
            className="noc-card flex items-center gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${c.color}18`, border: `1px solid ${c.color}40` }}
            >
              <c.icon style={{ color: c.color, fontSize: 20 }} />
            </div>
            <div>
              <p className="font-bold text-lg leading-none text-noc-textPri">{c.value}</p>
              <p className="text-[10px] text-noc-textDim">{c.label}</p>
              <p className="text-[9px] mt-0.5" style={{ color: c.color }}>{c.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Main content: topology + right panel ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Left 2-cols: topology + charts */}
        <div className="col-span-2 space-y-4">

          {/* Network Topology */}
          <div className="noc-card">
            <div className="flex items-center justify-between mb-3">
              <p className="section-title mb-0">Network Topology (Live)</p>
              <div className="flex items-center gap-4 text-[10px] text-noc-textSec">
                <Dot color="bg-noc-green"  label="Healthy" />
                <Dot color="bg-noc-yellow" label="Warning" />
                <Dot color="bg-noc-red"    label="Critical" />
                <span className="text-noc-textDim border-l border-noc-border pl-3">Live Topology Map</span>
              </div>
            </div>
            <div style={{ height: 320 }}>
              <NetworkTopology predResult={result} />
            </div>
          </div>

          {/* Telemetry charts */}
          <div className="grid grid-cols-3 gap-3">
            <LatencyChart    data={chartData} />
            <PacketLossChart data={chartData} />
            <UtilizationChart data={chartData} />
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-4">

          {/* Active Alerts */}
          <div className="noc-card flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MdNotifications className="text-noc-orange text-sm" />
                <p className="section-title mb-0">Active Alerts</p>
              </div>
              <button className="text-[10px] text-noc-cyan hover:underline">View All</button>
            </div>
            {MOCK_ALERTS.map((a) => (
              <div
                key={a.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                  a.level === 'critical' ? 'bg-red-900/10    border-red-700/25'    :
                  a.level === 'high'     ? 'bg-orange-900/10 border-orange-700/25' :
                                           'bg-yellow-900/10 border-yellow-700/25'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 animate-pulse ${
                  a.level === 'critical' ? 'bg-noc-red' : a.level === 'high' ? 'bg-noc-orange' : 'bg-noc-yellow'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-noc-textPri truncate">{a.title}</p>
                  <p className="text-[10px] text-noc-textDim">{a.site} · ETA {a.eta}</p>
                </div>
                <span className={`text-[9px] font-bold capitalize flex-shrink-0 ${
                  a.level === 'critical' ? 'text-noc-red' : a.level === 'high' ? 'text-noc-orange' : 'text-noc-yellow'
                }`}>{a.level}</span>
              </div>
            ))}
          </div>

          {/* AI Prediction box */}
          <AnimatePresence>
            {result && (
              <motion.div
                key="pred-summary"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="noc-card space-y-3"
                style={{ borderColor: `${riskColor(result.risk)}30` }}
              >
                <p className="section-title">AI Prediction (Live)</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0"
                    style={{
                      background: `${riskColor(result.risk)}15`,
                      border: `1px solid ${riskColor(result.risk)}50`,
                      color: riskColor(result.risk),
                    }}
                  >
                    {result.confidence_score?.toFixed(0)}%
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: riskColor(result.risk) }}>
                      {result.risk} Risk
                    </p>
                    <p className="text-[10px] text-noc-textDim">{result.site}</p>
                    <p className="text-[10px] text-noc-textSec">ETA {result.time_to_impact}</p>
                  </div>
                </div>
                {result.prediction_reason?.[0] && (
                  <p className="text-[11px] text-noc-textSec border-t border-noc-border/50 pt-2 leading-relaxed">
                    {result.prediction_reason[0]}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Prediction form */}
          <PredictionForm onSubmit={run} loading={loading} />
        </div>
      </div>

      {/* ── Risk + Confidence + TTI + Latency ── */}
      <div className="grid grid-cols-4 gap-4">
        <RiskCard
          risk={result?.risk}
          condition={result?.network_condition}
          loading={loading}
        />
        <ConfidenceGauge
          confidence={result?.confidence}
          confidenceScore={result?.confidence_score}
          loading={loading}
        />
        <TimeToImpactCard
          tti={result?.time_to_impact}
          ttiMinutes={result?.time_to_impact_minutes}
          loading={loading}
        />
        <LatencyCard
          predictionLatencyMs={result?.prediction_latency_ms}
          featureMapMs={result?.feature_map_ms}
          inferenceMs={result?.inference_ms}
          loading={loading}
        />
      </div>

      {/* ── Metrics + Reasons (only after prediction) ── */}
      <AnimatePresence>
        {result?.metrics && (
          <motion.div
            key="metrics-section"
            className="grid grid-cols-5 gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="col-span-3 space-y-2">
              <p className="section-title">Live Telemetry Metrics</p>
              <MetricsPanel metrics={result.metrics} />
            </div>
            <div className="col-span-2">
              <PredictionReasons reasons={result?.prediction_reason} loading={loading} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confidence timeline + History ── */}
      <div className="grid grid-cols-2 gap-4">
        <ConfidenceTimeline history={history} />
        <PredictionHistory  history={history} />
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
