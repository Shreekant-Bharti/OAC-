import { useState } from 'react'
import { motion } from 'framer-motion'
import { MdPlayArrow, MdRefresh, MdTune } from 'react-icons/md'
import { DEFAULT_TELEMETRY, SITES } from '../../utils/mockData'

const FIELDS = [
  { key: 'latency_ms',       label: 'Latency (ms)',     step: 0.1 },
  { key: 'packet_loss_pct',  label: 'Packet Loss (%)',  step: 0.01 },
  { key: 'utilization_pct',  label: 'Utilization (%)',  step: 0.1  },
  { key: 'jitter_ms',        label: 'Jitter (ms)',      step: 0.1  },
  { key: 'queue_length',     label: 'Queue Length',     step: 1    },
  { key: 'active_flows',     label: 'Active Flows',     step: 1    },
  { key: 'tunnel_uptime',    label: 'Tunnel Uptime',    step: 0.01 },
  { key: 'throughput_mbps',  label: 'Throughput (Mbps)',step: 1    },
]

export default function PredictionForm({ onSubmit, loading }) {
  const [form, setForm] = useState(DEFAULT_TELEMETRY)
  const [expanded, setExpanded] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({ ...form })
  }

  const handleReset = () => setForm(DEFAULT_TELEMETRY)

  return (
    <form onSubmit={handleSubmit} className="noc-card flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="section-title mb-0">Telemetry Input</div>
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 text-[10px] text-noc-textSec hover:text-noc-cyan transition-colors"
        >
          <MdTune className="text-sm" />
          {expanded ? 'Less' : 'More'} fields
        </button>
      </div>

      {/* Site + Device */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-noc-textDim mb-1">Site</label>
          <select
            className="noc-input w-full"
            value={form.site}
            onChange={e => set('site', e.target.value)}
          >
            {SITES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-noc-textDim mb-1">Device</label>
          <input
            className="noc-input w-full"
            value={form.device}
            onChange={e => set('device', e.target.value)}
          />
        </div>
      </div>

      {/* Core metric fields */}
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.slice(0, expanded ? FIELDS.length : 4).map(({ key, label, step }) => (
          <div key={key}>
            <label className="block text-[10px] text-noc-textDim mb-1">{label}</label>
            <input
              type="number"
              step={step}
              min="0"
              className="noc-input w-full"
              value={form[key] ?? ''}
              onChange={e => set(key, parseFloat(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>

      {/* Failure category */}
      {expanded && (
        <div>
          <label className="block text-[10px] text-noc-textDim mb-1">Failure Category</label>
          <select
            className="noc-input w-full"
            value={form.failure_category_enc}
            onChange={e => set('failure_category_enc', parseInt(e.target.value))}
          >
            <option value={0}>Congestion</option>
            <option value={1}>Policy Drift</option>
            <option value={2}>Routing Instability</option>
            <option value={3}>Tunnel Degradation</option>
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <motion.button
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="flex-1 noc-btn-primary flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <MdPlayArrow className="text-base" />
          )}
          {loading ? 'Predicting…' : 'Run Prediction'}
        </motion.button>
        <motion.button
          type="button"
          onClick={handleReset}
          whileTap={{ scale: 0.97 }}
          className="noc-btn border border-noc-border text-noc-textSec hover:text-noc-textPri hover:border-noc-borderHi"
        >
          <MdRefresh className="text-base" />
        </motion.button>
      </div>
    </form>
  )
}
