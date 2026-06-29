import { motion } from 'framer-motion'
import { MdSpeed } from 'react-icons/md'

export default function LatencyCard({ predictionLatencyMs, featureMapMs, inferenceMs, loading }) {
  if (loading) {
    return (
      <div className="noc-card animate-pulse space-y-3">
        <div className="h-3 w-24 bg-noc-border rounded" />
        <div className="h-12 bg-noc-border rounded" />
      </div>
    )
  }

  const total = predictionLatencyMs ?? 0
  const fast  = total < 100

  return (
    <motion.div
      className="noc-card-glow flex flex-col gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
    >
      <div className="section-title">Prediction Latency</div>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-purple-900/20 border border-purple-700/30 flex items-center justify-center">
          <MdSpeed className="text-xl text-purple-400" />
        </div>
        <div>
          <motion.p
            key={total}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className={`text-2xl font-bold font-mono leading-none ${fast ? 'text-noc-green' : 'text-noc-yellow'}`}
          >
            {total.toFixed(0)} <span className="text-sm font-normal text-noc-textSec">ms</span>
          </motion.p>
          <p className="text-[10px] text-noc-textDim mt-0.5">end-to-end</p>
        </div>
      </div>
      {(featureMapMs !== undefined || inferenceMs !== undefined) && (
        <div className="grid grid-cols-2 gap-2">
          <BreakdownItem label="Feature Map" value={featureMapMs} />
          <BreakdownItem label="Inference"   value={inferenceMs} />
        </div>
      )}
    </motion.div>
  )
}

function BreakdownItem({ label, value }) {
  return (
    <div className="bg-noc-surface/60 rounded-lg px-2.5 py-1.5">
      <p className="text-[9px] text-noc-textDim">{label}</p>
      <p className="text-xs font-mono font-medium text-noc-textSec">{value?.toFixed(1) ?? '—'} ms</p>
    </div>
  )
}
