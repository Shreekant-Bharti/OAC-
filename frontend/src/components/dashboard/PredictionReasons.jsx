import { motion } from 'framer-motion'
import { MdWarningAmber, MdCheckCircle } from 'react-icons/md'

export default function PredictionReasons({ reasons, loading }) {
  if (loading) {
    return (
      <div className="noc-card space-y-2 animate-pulse">
        <div className="h-3 w-36 bg-noc-border rounded" />
        {[1,2,3].map(i => <div key={i} className="h-10 bg-noc-border rounded-lg" />)}
      </div>
    )
  }

  const allClear = !reasons || reasons.length === 0 ||
    (reasons.length === 1 && reasons[0].toLowerCase().includes('normal'))

  return (
    <div className="noc-card-glow flex flex-col gap-3">
      <div className="section-title">Prediction Signals</div>

      {allClear ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-900/15 border border-green-700/25">
          <MdCheckCircle className="text-noc-green text-xl flex-shrink-0" />
          <p className="text-sm text-noc-green">All metrics within normal operating bounds</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reasons.map((reason, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg bg-orange-900/10 border border-orange-700/20"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <MdWarningAmber className="text-noc-orange text-base flex-shrink-0 mt-0.5" />
              <p className="text-sm text-noc-textPri leading-relaxed">{reason}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
