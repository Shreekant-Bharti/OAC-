import { useState } from 'react'
import { motion } from 'framer-motion'
import NetworkTopology from '../components/topology/NetworkTopology'
import { TOPOLOGY_NODES_INIT } from '../utils/mockData'
import { usePredict } from '../hooks/usePredict'
import PredictionForm from '../components/dashboard/PredictionForm'

export default function TopologyPage() {
  const { result, loading, run } = usePredict()
  const [selectedNode, setSelectedNode] = useState(null)

  return (
    <div className="p-4 flex flex-col gap-4" style={{ height: 'calc(100vh - 88px)' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-noc-textPri">Network Topology</h1>
          <p className="text-xs text-noc-textSec">Live MPLS/SD-WAN topology — click nodes for details</p>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          {[
            ['bg-noc-green',  'Healthy'],
            ['bg-noc-yellow', 'Warning'],
            ['bg-noc-red',    'Critical'],
          ].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-noc-textSec">
              <span className={`w-2.5 h-2.5 rounded-full ${c}`} /> {l}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
        {/* Topology canvas */}
        <div className="col-span-3 noc-card-glow" style={{ minHeight: 500 }}>
          <NetworkTopology predResult={result} />
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          <PredictionForm onSubmit={run} loading={loading} />

          {/* Node list */}
          <div className="noc-card-glow flex flex-col gap-2">
            <p className="section-title">Node Status</p>
            {TOPOLOGY_NODES_INIT.map(n => (
              <motion.div
                key={n.id}
                whileHover={{ x: 2 }}
                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-noc-border/30 cursor-pointer transition-colors"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  n.status === 'healthy'  ? 'bg-noc-green'  :
                  n.status === 'warning'  ? 'bg-noc-yellow' : 'bg-noc-red'
                } animate-pulse`} />
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

          {/* Prediction result if available */}
          {result && (
            <div className="noc-card-glow text-xs space-y-2">
              <p className="section-title">Last Prediction</p>
              <Row k="Site"      v={result.site} />
              <Row k="Risk"      v={result.risk} />
              <Row k="TTI"       v={result.time_to_impact} />
              <Row k="Confidence" v={`${result.confidence_score}%`} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between">
      <span className="text-noc-textDim">{k}</span>
      <span className="text-noc-textPri font-medium">{v}</span>
    </div>
  )
}
