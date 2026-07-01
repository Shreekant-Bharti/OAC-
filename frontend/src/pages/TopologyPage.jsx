import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { MdRouter, MdDns, MdMemory, MdAssessment } from 'react-icons/md'
import NetworkTopology from '../components/topology/NetworkTopology'
import { TOPOLOGY_NODES_INIT } from '../utils/mockData'
import { usePredict }  from '../hooks/usePredict'
import { useWebSocket } from '../hooks/useWebSocket'

const NODE_LABELS = {
  'br-a': 'Branch A',
  'br-b': 'Branch B',
  'br-c': 'Branch C',
  'dc':   'Data Centre',
  'hub':  'Intelligent Hub',
}

export default function TopologyPage() {
  const { result, loading, run } = usePredict()
  const { telemetry, deviceInfo, wsStatus, lastUpdated } = useWebSocket()
  const [selectedNode, setSelectedNode] = useState(null)

  // Ref guard — prevent prediction firing more than once per unique timestamp
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

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="p-4 flex flex-col gap-4" style={{ height: 'calc(100vh - 88px)' }}>

      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-noc-textPri">Network Topology</h1>
          <p className="text-xs text-noc-textSec">
            Live intelligent hub · A · B · C · DC — auto-animating from chat messages
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-noc-textSec">
          {[['bg-noc-green','Online'],['bg-noc-yellow','Warning'],['bg-noc-red','Critical']].map(([c,l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${c}`} /> {l}
            </span>
          ))}
          {timeStr && (
            <span className="text-noc-textDim border-l border-noc-border pl-3">
              Last: {timeStr}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">

        {/* Topology canvas */}
        <div className="col-span-3 noc-card" style={{ minHeight: 460 }}>
          <NetworkTopology
            predResult={result}
            liveTelemetry={telemetry}
            deviceInfo={deviceInfo}
          />
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4 overflow-y-auto">

          {/* Live status indicator */}
          <div className={`noc-card flex items-center gap-2 py-2 px-3 text-xs ${
            wsStatus === 'connected' ? 'border-emerald-500/30' : 'border-red-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
            }`} />
            <span className={wsStatus === 'connected' ? 'text-emerald-400' : 'text-red-400'}>
              {wsStatus === 'connected' ? 'Live Data Active' : wsStatus === 'connecting' ? 'Polling…' : 'Offline'}
            </span>
          </div>

          {/* Node Status list */}
          <div className="noc-card flex flex-col gap-2">
            <p className="section-title">Node Status</p>
            {(TOPOLOGY_NODES_INIT || []).map(n => (
              <motion.div
                key={n.id}
                whileHover={{ x: 2 }}
                onClick={() => setSelectedNode(n)}
                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-noc-border/30 cursor-pointer transition-colors"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 animate-pulse ${
                  n.status === 'healthy'  ? 'bg-noc-green'  :
                  n.status === 'warning'  ? 'bg-noc-yellow' : 'bg-noc-red'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-noc-textPri truncate">{n.label}</p>
                  <p className="text-[9px] text-noc-textDim font-mono">{n.ip}</p>
                </div>
                <span className={`text-[9px] capitalize ${
                  n.status === 'healthy'  ? 'text-noc-green'  :
                  n.status === 'warning'  ? 'text-noc-yellow' : 'text-noc-red'
                }`}>{n.status}</span>
              </motion.div>
            ))}
          </div>

          {/* Prediction result card */}
          {result && (
            <div className="noc-card space-y-2">
              <div className="flex items-center gap-2">
                <MdAssessment className="text-noc-cyan text-sm" />
                <p className="section-title mb-0">AI Prediction</p>
              </div>
              {[
                ['Site',       result.site],
                ['Risk',       result.risk],
                ['TTI',        result.time_to_impact],
                ['Confidence', result.confidence_score ? `${result.confidence_score}%` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center py-0.5 border-b border-noc-border/20 last:border-0">
                  <span className="text-[10px] text-noc-textDim uppercase">{k}</span>
                  <span className="text-noc-textPri font-semibold font-mono text-xs">{v ?? '—'}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
