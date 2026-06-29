import { motion } from 'framer-motion'
import { MdTimer, MdFlashOn } from 'react-icons/md'

export default function TimeToImpactCard({ tti, ttiMinutes, loading }) {
  const urgent = ttiMinutes !== undefined && ttiMinutes < 10

  if (loading) {
    return (
      <div className="noc-card animate-pulse space-y-3">
        <div className="h-3 w-28 bg-noc-border rounded" />
        <div className="h-12 bg-noc-border rounded" />
        <div className="h-3 w-20 bg-noc-border rounded" />
      </div>
    )
  }

  return (
    <motion.div
      className="noc-card-glow flex flex-col gap-3 relative overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
    >
      {urgent && (
        <div className="absolute inset-0 rounded-xl border border-red-500/30 pointer-events-none animate-pulse" />
      )}

      <div className="flex items-center justify-between">
        <div className="section-title mb-0">Time to Impact</div>
        {urgent && <MdFlashOn className="text-noc-red text-base animate-pulse" />}
      </div>

      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          urgent ? 'bg-red-900/30 border border-red-700/40' : 'bg-noc-border/50'
        }`}>
          <MdTimer className={`text-xl ${urgent ? 'text-noc-red' : 'text-noc-cyan'}`} />
        </div>
        <div>
          <motion.p
            key={tti}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className={`text-2xl font-bold font-mono leading-none ${urgent ? 'text-noc-red' : 'text-noc-cyan'}`}
          >
            {tti || '—'}
          </motion.p>
          <p className="text-[10px] text-noc-textDim mt-0.5">estimated impact</p>
        </div>
      </div>

      {ttiMinutes !== undefined && (
        <div className="h-1.5 rounded-full bg-noc-border overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: urgent
                ? 'linear-gradient(90deg,#ff3b3b,#ff8c00)'
                : 'linear-gradient(90deg,#00d4ff,#1a6bff)',
            }}
            initial={{ width: 0 }}
            animate={{ width: urgent ? '90%' : ttiMinutes < 30 ? '60%' : '25%' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      )}
    </motion.div>
  )
}
