import { motion } from 'framer-motion'
import { MdCheckCircle, MdError, MdWarning, MdRefresh } from 'react-icons/md'
import { useHealth } from '../hooks/useHealth'

const SUBSYSTEMS = [
  { key: 'backend',     label: 'Backend API',       check: (h) => h?.status === 'ok' },
  { key: 'ml',          label: 'ML Engine (B)',      check: (h) => h?.ml_model_loaded },
  { key: 'chromadb',    label: 'ChromaDB Vector DB', check: (h) => !!h?.collection },
  { key: 'kb',          label: 'Knowledge Base',     check: (h) => (h?.total_chunks ?? 0) > 0 },
  { key: 'phi3',        label: 'Phi-3 LLM',          check: (h) => !!h?.model },
  { key: 'pred_engine', label: 'Prediction Engine',  check: (h) => !!h?.prediction_engine },
]

function StatusRow({ label, ok, detail }) {
  const Icon  = ok === null ? MdWarning : ok ? MdCheckCircle : MdError
  const color = ok === null ? 'text-noc-yellow' : ok ? 'text-noc-green' : 'text-noc-red'
  const bg    = ok === null ? 'bg-yellow-900/15 border-yellow-700/25' :
                ok           ? 'bg-green-900/15  border-green-700/25'  :
                               'bg-red-900/15    border-red-700/25'

  return (
    <motion.div
      className={`flex items-center gap-4 p-3 rounded-xl border ${bg}`}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <Icon className={`${color} text-xl flex-shrink-0`} />
      <div className="flex-1">
        <p className="text-sm font-medium text-noc-textPri">{label}</p>
        {detail && <p className="text-[11px] text-noc-textSec">{detail}</p>}
      </div>
      <span className={`text-xs font-semibold ${color}`}>
        {ok === null ? 'Checking…' : ok ? 'Online' : 'Offline'}
      </span>
    </motion.div>
  )
}

export default function SystemHealthPage() {
  const { health, loading, error, online, refetch } = useHealth(30000)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-noc-textPri">System Health</h1>
          <p className="text-xs text-noc-textSec mt-0.5">Real-time backend and subsystem status</p>
        </div>
        <button
          onClick={refetch}
          className="noc-btn-cyan flex items-center gap-2 text-xs"
        >
          <MdRefresh className={`text-base ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overall status */}
      <div className={`noc-card flex items-center gap-5 p-5 ${
        error ? 'border-red-700/40' : online ? 'border-green-700/40' : 'border-noc-border'
      }`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
          error ? 'bg-red-900/20'   :
          online ? 'bg-green-900/20' : 'bg-noc-border'
        }`}>
          {error ? '🔴' : online ? '✅' : '⏳'}
        </div>
        <div>
          <p className={`text-2xl font-bold ${error ? 'text-noc-red' : online ? 'text-noc-green' : 'text-noc-textDim'}`}>
            {error ? 'Backend Offline' : online ? 'All Systems Operational' : 'Connecting…'}
          </p>
          <p className="text-xs text-noc-textSec mt-1">
            {error ? error : health?.startup_time ? `Started: ${health.startup_time}` : 'Checking backend…'}
          </p>
        </div>
      </div>

      {/* Subsystems */}
      {/* Subsystems */}
      <div className="space-y-3">
        <p className="section-title">Subsystem Status</p>
        {SUBSYSTEMS.map(({ key, label, check }) => {
          const ok = loading ? null : health ? check(health) : false
          const detail =
            key === 'ml'       ? health?.prediction_engine :
            key === 'chromadb' ? health?.collection :
            key === 'kb'       ? `${health?.total_chunks ?? 0} chunks loaded` :
            key === 'phi3'     ? health?.model :
            key === 'pred_engine' ? health?.prediction_engine :
            null
          return <StatusRow key={key} label={label} ok={ok} detail={detail} />
        })}
      </div>

      {/* Detailed info */}
      {health && (
        <div className="noc-card space-y-3">
          <p className="section-title">System Information</p>
          <div className="divide-y divide-noc-border/40">
            {[
              ['Backend Version',   health.version],
              ['Prediction Engine', health.prediction_engine],
              ['LLM Model',         health.model],
              ['Vector DB',         health.vector_db || health.collection],
              ['KB Chunks',         health.total_chunks],
              ['ML Model Loaded',   health.ml_model_loaded ? 'Yes' : 'No'],
              ['API Status',        health.status?.toUpperCase()],
              ['Startup Time',      health.startup_time ? new Date(health.startup_time).toLocaleString('en-IN') : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-2.5">
                <span className="text-noc-textSec text-xs">{k}</span>
                <span className="font-mono text-noc-cyan text-xs font-medium">{v ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
