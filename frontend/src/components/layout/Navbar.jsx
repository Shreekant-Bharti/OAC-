import { useState, useEffect } from 'react'
import { MdShield, MdWifi, MdWifiOff, MdAccessTime, MdCircle } from 'react-icons/md'
import { formatTime, formatDate } from '../../utils/formatters'
import { useHealth } from '../../hooks/useHealth'

export default function Navbar() {
  const [now, setNow] = useState(new Date())
  const { online, health } = useHealth()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="h-12 flex items-center justify-between px-5 border-b border-noc-border glass flex-shrink-0 relative z-10">
      {/* Left — Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <MdShield className="text-noc-green text-base" />
          <span className="text-[11px] font-semibold text-noc-green tracking-wide">
            SYSTEM STATUS: {online ? 'SECURE & OPERATIONAL' : 'BACKEND OFFLINE'}
          </span>
        </div>
        <div className="w-px h-4 bg-noc-border" />
        <span className="text-[10px] text-noc-textDim font-mono">v2.0.0</span>
      </div>

      {/* Center — Title */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center hidden md:block">
        <p className="text-[11px] font-bold tracking-widest text-noc-textPri uppercase">
          Offline AI NOC Copilot
        </p>
        <p className="text-[9px] text-noc-textDim tracking-wider">ISRO · Bharatiya Antariksh Hackathon 2026</p>
      </div>

      {/* Right — Clock + Conn */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-noc-textSec">
          <MdAccessTime className="text-sm" />
          <span className="text-xs font-mono">{formatDate(now)}</span>
          <span className="text-xs font-mono font-semibold text-noc-textPri">{formatTime(now)}</span>
        </div>
        <div className="w-px h-4 bg-noc-border" />
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
          online
            ? 'text-noc-green border-green-700/40 bg-green-900/20'
            : 'text-noc-red border-red-700/40 bg-red-900/20'
        }`}>
          {online ? <MdWifi className="text-sm" /> : <MdWifiOff className="text-sm" />}
          {online ? 'Connected' : 'Offline'}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-noc-orange border border-orange-700/40 bg-orange-900/20 px-2.5 py-1 rounded-full font-semibold">
          <MdCircle className="text-[8px]" />
          Offline Mode
        </div>
      </div>
    </header>
  )
}
