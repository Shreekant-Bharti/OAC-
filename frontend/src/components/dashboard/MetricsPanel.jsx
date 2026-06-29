import { motion, AnimatePresence } from 'framer-motion'
import { formatBytes, formatNumber } from '../../utils/formatters'

const METRICS = [
  { key: 'latency_ms',      label: 'Latency',     unit: 'ms',   fmt: (v) => formatNumber(v, 1), warnAt: 50,  critAt: 100,  color: '#00d4ff' },
  { key: 'packet_loss_pct', label: 'Packet Loss',  unit: '%',   fmt: (v) => formatNumber(v, 2), warnAt: 1,   critAt: 5,    color: '#ff8c00' },
  { key: 'utilization_pct', label: 'Utilization',  unit: '%',   fmt: (v) => formatNumber(v, 1), warnAt: 70,  critAt: 90,   color: '#6c63ff' },
  { key: 'jitter_ms',       label: 'Jitter',       unit: 'ms',  fmt: (v) => formatNumber(v, 1), warnAt: 10,  critAt: 30,   color: '#ffd700' },
  { key: 'bgp_flaps',       label: 'BGP Flaps',    unit: '',    fmt: (v) => String(v ?? 0),     warnAt: 2,   critAt: 5,    color: '#ff3b3b' },
  { key: 'queue_length',    label: 'Queue Length',  unit: 'pk', fmt: (v) => formatNumber(v, 0), warnAt: 150, critAt: 250,  color: '#00d4ff' },
  { key: 'throughput_mbps', label: 'Throughput',   unit: 'Mbps',fmt: (v) => formatNumber(v, 0), warnAt: 800, critAt: 1200, color: '#00e676' },
  { key: 'rx_bytes',        label: 'RX Bytes',     unit: '',    fmt: (v) => formatBytes(v),      warnAt: null,critAt: null, color: '#6c63ff' },
  { key: 'tx_bytes',        label: 'TX Bytes',     unit: '',    fmt: (v) => formatBytes(v),      warnAt: null,critAt: null, color: '#1a6bff' },
]

export default function MetricsPanel({ metrics }) {
  if (!metrics) return null

  return (
    <div className="grid grid-cols-3 gap-3 xl:grid-cols-3">
      {METRICS.map((m) => {
        const raw = metrics[m.key]
        const val = raw ?? metrics[m.key.replace('_ms', '').replace('_pct', '').replace('_mbps', '')] ?? 0
        const numVal = parseFloat(val) || 0
        const isCrit = m.critAt && numVal >= m.critAt
        const isWarn = m.warnAt && numVal >= m.warnAt && !isCrit
        const barPct = m.critAt ? Math.min(100, (numVal / m.critAt) * 100) : 0

        return (
          <motion.div
            key={m.key}
            className="noc-card-glow flex flex-col gap-2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-noc-textSec font-medium">{m.label}</p>
              {isCrit && <span className="text-[9px] text-noc-red font-semibold">CRIT</span>}
              {isWarn && <span className="text-[9px] text-noc-yellow font-semibold">WARN</span>}
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={String(val)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="font-mono text-xl font-bold leading-none"
                style={{ color: isCrit ? '#ff3b3b' : isWarn ? '#ffd700' : m.color }}
              >
                {m.fmt(raw)}
                {m.unit && (
                  <span className="text-xs font-normal text-noc-textDim ml-1">{m.unit}</span>
                )}
              </motion.p>
            </AnimatePresence>
            {m.critAt && (
              <div className="h-1 rounded-full bg-noc-border overflow-hidden">
                <motion.div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barPct}%`,
                    background: isCrit
                      ? '#ff3b3b'
                      : isWarn
                      ? '#ffd700'
                      : m.color,
                  }}
                />
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
