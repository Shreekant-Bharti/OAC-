import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MdSpaceDashboard, MdAccountTree, MdSmartToy,
  MdMonitorHeart, MdMenuBook, MdSettings, MdSatelliteAlt,
} from 'react-icons/md'
import { useHealth } from '../../hooks/useHealth'

const NAV = [
  { to: '/',          icon: MdSpaceDashboard, label: 'Dashboard'       },
  { to: '/topology',  icon: MdAccountTree,    label: 'Network Topology' },
  { to: '/copilot',   icon: MdSmartToy,       label: 'AI Copilot'      },
  { to: '/health',    icon: MdMonitorHeart,   label: 'System Health'   },
  { to: '/docs',      icon: MdMenuBook,       label: 'Documentation'   },
  { to: '/settings',  icon: MdSettings,       label: 'Settings'        },
]

export default function Sidebar() {
  const { health, online } = useHealth()

  return (
    <aside className="w-56 h-screen flex flex-col bg-noc-surface border-r border-noc-border flex-shrink-0 relative z-20">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-noc-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#1a6bff,#00d4ff)' }}>
            <MdSatelliteAlt className="text-white text-lg" />
          </div>
          <div>
            <p className="text-xs font-bold text-noc-textPri leading-tight">AI NOC COPILOT</p>
            <p className="text-[10px] text-noc-textSec leading-tight">Bharatiya Antariksh</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className={online ? 'status-dot-green' : 'status-dot-red'} />
          <span className="text-[10px] text-noc-textSec">
            {online ? 'Air-Gap · Offline Mode' : 'Backend Offline'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {({ isActive }) => (
              <motion.div
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-noc-blue/20 text-noc-cyan border border-noc-blue/30'
                    : 'text-noc-textSec hover:text-noc-textPri hover:bg-noc-border/50'
                }`}
              >
                <Icon className={`text-base flex-shrink-0 ${isActive ? 'text-noc-cyan' : ''}`} />
                <span className="font-medium">{label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-noc-cyan" />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* System info footer */}
      <div className="px-4 py-3 border-t border-noc-border space-y-1.5">
        <p className="section-title mb-2">System Info</p>
        <InfoRow label="AI Engine"   value={health?.ml_model_loaded ? 'Engine B' : 'Engine A'} color="text-noc-green" />
        <InfoRow label="Vector DB"   value="ChromaDB" color="text-noc-cyan" />
        <InfoRow label="LLM Model"   value={health?.model ? health.model.split(':')[0] : 'Phi-3'} color="text-noc-cyan" />
        <InfoRow label="KB Chunks"   value={health?.total_chunks ?? '—'} color="text-noc-textPri" />
        <InfoRow label="Air-Gap"     value="ENFORCED" color="text-noc-red" />
      </div>

      {/* Copilot CTA */}
      <div className="p-3 border-t border-noc-border">
        <div className="rounded-lg p-3" style={{ background: 'linear-gradient(135deg,rgba(26,107,255,0.15),rgba(0,212,255,0.08))' }}>
          <p className="text-xs text-noc-textSec mb-0.5">NOC COPILOT</p>
          <p className="text-[11px] text-noc-textPri mb-2 leading-relaxed">
            Ask anything about your network
          </p>
          <NavLink to="/copilot">
            <button className="w-full noc-btn-cyan text-[11px] py-1.5 flex items-center justify-center gap-1.5">
              <MdSmartToy /> Open Copilot
            </button>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}

function InfoRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-noc-textDim">{label}</span>
      <span className={`text-[10px] font-medium font-mono ${color}`}>{value}</span>
    </div>
  )
}
