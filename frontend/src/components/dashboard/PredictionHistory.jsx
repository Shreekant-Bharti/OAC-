import { motion } from 'framer-motion'
import { riskColor } from '../../utils/formatters'

const RISK_ORDER = { critical: 0, high: 1, medium: 2, low: 3, normal: 4 }

export default function PredictionHistory({ history }) {
  return (
    <div className="noc-card-glow flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="section-title mb-0">Prediction History</div>
        <span className="text-[10px] text-noc-textDim">{history.length} records</span>
      </div>

      {history.length === 0 ? (
        <div className="py-8 text-center text-noc-textDim text-sm">
          No predictions yet — run a prediction to see history
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-noc-border text-noc-textDim">
                {['Time','Site','Risk','Confidence','TTI','Condition','Latency'].map(h => (
                  <th key={h} className="text-left pb-2 pr-4 font-medium text-[10px] tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-noc-border/40">
              {history.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                  className="hover:bg-noc-border/20 transition-colors"
                >
                  <td className="py-2 pr-4 font-mono text-noc-textDim">{row.timestamp}</td>
                  <td className="py-2 pr-4 text-noc-textPri font-medium">{row.site}</td>
                  <td className="py-2 pr-4">
                    <span
                      className="font-semibold"
                      style={{ color: riskColor(row.risk) }}
                    >
                      {row.risk}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-mono text-noc-textSec">{row.confidenceScore}%</td>
                  <td className="py-2 pr-4 text-noc-textSec">{row.tti}</td>
                  <td className="py-2 pr-4 text-noc-textSec">{row.condition}</td>
                  <td className="py-2 font-mono text-noc-textDim">{row.latencyMs?.toFixed(0)}ms</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
