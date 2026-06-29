import { motion } from 'framer-motion'
import { MdOutlineWarningAmber, MdCheckCircleOutline, MdError, MdInfo } from 'react-icons/md'
import { riskColor, riskBg } from '../../utils/formatters'

const ICONS = {
  critical: MdError,
  high:     MdOutlineWarningAmber,
  medium:   MdInfo,
  low:      MdCheckCircleOutline,
  normal:   MdCheckCircleOutline,
}

export default function RiskCard({ risk, condition, loading }) {
  const level = (risk || 'normal').toLowerCase()
  const color = riskColor(risk)
  const bg    = riskBg(risk)
  const Icon  = ICONS[level] || MdInfo

  if (loading) return <SkeletonCard />

  return (
    <motion.div
      className="noc-card-glow flex flex-col gap-3 relative overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {/* Glow orb */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-30"
        style={{ background: color }}
      />

      <div className="section-title">Current Risk Level</div>

      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: bg, border: `1px solid ${color}40` }}
        >
          <Icon style={{ color, fontSize: 32 }} />
        </div>
        <div>
          <motion.p
            key={risk}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-3xl font-bold leading-none"
            style={{ color }}
          >
            {risk || '—'}
          </motion.p>
          <p className="text-xs text-noc-textSec mt-1">{condition || 'No prediction yet'}</p>
        </div>
      </div>

      {/* Level bar */}
      <div className="h-1.5 rounded-full bg-noc-border overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: level === 'critical' ? '100%' : level === 'high' ? '75%' : level === 'medium' ? '50%' : '20%' }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

function SkeletonCard() {
  return (
    <div className="noc-card animate-pulse space-y-3">
      <div className="h-3 w-28 bg-noc-border rounded" />
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-noc-border" />
        <div className="space-y-2">
          <div className="h-8 w-24 bg-noc-border rounded" />
          <div className="h-3 w-32 bg-noc-border rounded" />
        </div>
      </div>
    </div>
  )
}
