import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

export default function ConfidenceGauge({ confidence, confidenceScore, loading }) {
  const value = confidenceScore ?? confidence ?? 0
  const pct   = Math.min(100, Math.max(0, value))

  const color =
    pct >= 90 ? '#00e676' :
    pct >= 70 ? '#ffd700' :
    pct >= 50 ? '#ff8c00' : '#ff3b3b'

  const data = [
    { value: pct },
    { value: 100 - pct },
  ]

  if (loading) {
    return (
      <div className="noc-card animate-pulse space-y-3">
        <div className="h-3 w-24 bg-noc-border rounded" />
        <div className="h-32 bg-noc-border rounded" />
      </div>
    )
  }

  return (
    <motion.div
      className="noc-card flex flex-col gap-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
    >
      <div className="section-title">Confidence Score</div>
      <div className="relative h-32 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="80%"
              startAngle={180}
              endAngle={0}
              innerRadius={52}
              outerRadius={68}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={color} />
              <Cell fill="#1a2744" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute bottom-2 text-center">
          <motion.p
            key={pct}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-2xl font-bold font-mono leading-none"
            style={{ color }}
          >
            {pct.toFixed(1)}
          </motion.p>
          <p className="text-[10px] text-noc-textDim">%</p>
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-noc-textDim px-1">
        <span>0%</span>
        <span className="text-noc-textSec">Confidence</span>
        <span>100%</span>
      </div>
    </motion.div>
  )
}
