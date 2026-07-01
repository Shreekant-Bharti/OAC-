import { useMemo, useEffect, useRef, useState } from 'react'

/* ─── Node layout (fixed positions on a 600×340 canvas) ───── */
const NODES = {
  hub:  { x: 300, y: 160, label: 'Intelligent Hub', icon: '🧠', type: 'hub' },
  dc:   { x: 300, y:  38, label: 'Data Centre',      icon: '🖥',  type: 'dc'  },
  bra:  { x:  90, y: 278, label: 'Branch A',          icon: '📡', type: 'branch' },
  brb:  { x: 300, y: 290, label: 'Branch B',          icon: '📡', type: 'branch' },
  brc:  { x: 510, y: 278, label: 'Branch C',          icon: '📡', type: 'branch' },
}

/* Links between nodes */
const LINKS = [
  { id: 'hub-dc',  from: 'hub', to: 'dc'  },
  { id: 'hub-bra', from: 'hub', to: 'bra' },
  { id: 'hub-brb', from: 'hub', to: 'brb' },
  { id: 'hub-brc', from: 'hub', to: 'brc' },
]

/* ─── ID → node key mapping ───────────────────────────────── */
const CHAT_ID_MAP = {
  b1: 'bra',
  b2: 'brb',
  b3: 'brc',
  dc: 'dc',
  hub: 'hub',
}
function resolveNodeKey(id = '') {
  return CHAT_ID_MAP[id.toLowerCase()] ?? null
}

/* ─── Status colors ───────────────────────────────────────── */
const STATUS = {
  healthy:  { ring: '#00e676', fill: '#00e67622', glow: 'rgba(0,230,118,0.45)',  dot: '#00e676', label: 'Online'   },
  warning:  { ring: '#ffd700', fill: '#ffd70022', glow: 'rgba(255,215,0,0.45)',  dot: '#ffd700', label: 'Warning'  },
  critical: { ring: '#ff3b3b', fill: '#ff3b3b22', glow: 'rgba(255,59,59,0.45)', dot: '#ff3b3b', label: 'Critical' },
}

/* ─── Parse chat message ──────────────────────────────────── */
function parseChatMsg(raw) {
  if (!raw) return null
  const m = raw.match(/^\[([A-Z0-9]+)\s+to\s+([A-Z0-9]+)\]/i)
  if (!m) return null
  const fromKey = resolveNodeKey(m[1])
  const toKey   = resolveNodeKey(m[2])
  return fromKey && toKey ? { from: fromKey, to: toKey } : null
}

/* Build an SVG path through the hub for branch-to-branch / branch-to-DC traffic */
function buildPath(fromKey, toKey) {
  const a = NODES[fromKey]
  const b = NODES[toKey]
  const h = NODES.hub

  if (!a || !b) return ''

  // If one end is the hub → straight line
  if (fromKey === 'hub' || toKey === 'hub') {
    return `M${a.x},${a.y} L${b.x},${b.y}`
  }
  // Otherwise route through hub
  return `M${a.x},${a.y} L${h.x},${h.y} L${b.x},${b.y}`
}

/* ─── Packet dot animated along an SVG path ──────────────── */
function PacketDot({ pathDef, color, speed = 2000 }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const pathRef  = useRef(null)
  const frameRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    if (!pathRef.current) return

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const t = (elapsed % speed) / speed
      try {
        const total = pathRef.current.getTotalLength()
        const pt    = pathRef.current.getPointAtLength(t * total)
        setPos({ x: pt.x, y: pt.y })
      } catch (_) {}
      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [speed, pathDef])

  return (
    <g>
      {/* Hidden measurement path */}
      <path ref={pathRef} d={pathDef} fill="none" stroke="none" />
      {/* Glowing dot */}
      <circle
        cx={pos.x} cy={pos.y} r={5}
        fill={color}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <circle cx={pos.x} cy={pos.y} r={9} fill={color} opacity={0.18} />
    </g>
  )
}

/* ─── Single topology node ─────────────────────────────────── */
function TopoNode({ nodeKey, status = 'healthy', isActive = false, metrics }) {
  const n  = NODES[nodeKey]
  const sc = STATUS[status] ?? STATUS.healthy
  const isHub = nodeKey === 'hub'
  const [hovered, setHovered] = useState(false)

  const radius = isHub ? 34 : nodeKey === 'dc' ? 26 : 22

  return (
    <g
      style={{ cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hub pulse ring */}
      {isHub && (
        <circle
          cx={n.x} cy={n.y} r={radius + 14}
          fill="none"
          stroke={sc.ring}
          strokeWidth={1}
          opacity={0.25}
          style={{ animation: 'topo-pulse 2.4s ease-in-out infinite' }}
        />
      )}

      {/* Outer glow */}
      <circle cx={n.x} cy={n.y} r={radius + 6}
        fill={sc.fill}
        style={{ filter: `blur(6px)` }}
      />

      {/* Main circle */}
      <circle
        cx={n.x} cy={n.y} r={radius}
        fill={sc.fill}
        stroke={sc.ring}
        strokeWidth={isHub ? 2.5 : (isActive || hovered) ? 2.5 : 1.8}
        style={{
          filter: (isActive || hovered) ? `drop-shadow(0 0 14px ${sc.ring})` : `drop-shadow(0 0 4px ${sc.ring}60)`,
          transition: 'all 0.3s',
          transform: hovered ? `scale(1.08)` : 'scale(1)',
          transformOrigin: `${n.x}px ${n.y}px`,
        }}
      />

      {/* Icon */}
      <text
        x={n.x} y={n.y + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={isHub ? 18 : 14}
        style={{ userSelect: 'none' }}
      >
        {n.icon}
      </text>

      {/* Label */}
      <text
        x={n.x}
        y={n.y + radius + 14}
        textAnchor="middle"
        fontSize={isHub ? 10 : 9}
        fontWeight="700"
        fill={isHub ? '#00d4ff' : '#c8d8f0'}
        fontFamily="Inter, sans-serif"
        style={{ userSelect: 'none' }}
      >
        {n.label}
      </text>

      {/* Status badge */}
      <g>
        <rect
          x={n.x - 22} y={n.y + radius + 20}
          width={44} height={13}
          rx={6} ry={6}
          fill={`${sc.ring}18`}
          stroke={`${sc.ring}50`}
          strokeWidth={0.8}
        />
        <circle cx={n.x - 12} cy={n.y + radius + 26.5} r={3} fill={sc.dot} />
        <text
          x={n.x - 4} y={n.y + radius + 27}
          fontSize={7} fontWeight="700"
          fill={sc.ring} fontFamily="Inter, sans-serif"
          dominantBaseline="middle"
          style={{ userSelect: 'none' }}
        >
          {sc.label}
        </text>
      </g>

      {/* Live metrics (latency/loss) — shown on active site */}
      {metrics && (
        <text
          x={n.x} y={n.y + radius + 38}
          textAnchor="middle" fontSize={7.5}
          fill="#7a99cc" fontFamily="JetBrains Mono, monospace"
          style={{ userSelect: 'none' }}
        >
          {metrics}
        </text>
      )}
    </g>
  )
}

/* ─── Main component ──────────────────────────────────────── */
/**
 * Props:
 *   predResult    – latest AI prediction
 *   liveTelemetry – telemetry sub-object (site, latency_ms, packet_loss_pct, …)
 *   deviceInfo    – full ESP32 payload (contains .chat for animations)
 */
export default function NetworkTopology({ predResult, liveTelemetry, deviceInfo }) {
  /* 1. Compute per-node status */
  const nodeStatuses = useMemo(() => {
    const statuses = {}
    Object.keys(NODES).forEach(k => { statuses[k] = 'healthy' })

    // Update active site from live telemetry
    if (liveTelemetry?.site) {
      const site = liveTelemetry.site.toLowerCase()
      let activeKey = null
      if (site.includes('branch a') || site === 'branch a') activeKey = 'bra'
      else if (site.includes('branch b') || site === 'branch b') activeKey = 'brb'
      else if (site.includes('branch c') || site === 'branch c') activeKey = 'brc'
      else if (site.includes('dc') || site.includes('data')) activeKey = 'dc'
      else if (site.includes('hub')) activeKey = 'hub'

      if (activeKey) {
        const util = parseFloat(liveTelemetry.utilization_pct ?? 0)
        const loss = parseFloat(liveTelemetry.packet_loss_pct ?? 0)
        const lat  = parseFloat(liveTelemetry.latency_ms ?? 0)
        statuses[activeKey] =
          util >= 90 || loss >= 5  || lat >= 80 ? 'critical' :
          util >= 70 || loss >= 1  || lat >= 40 ? 'warning'  : 'healthy'
      }
    }

    // Override from prediction result
    if (predResult?.site) {
      const site = predResult.site.toLowerCase()
      let key = null
      if (site.includes('branch a')) key = 'bra'
      else if (site.includes('branch b')) key = 'brb'
      else if (site.includes('branch c')) key = 'brc'
      else if (site.includes('dc') || site.includes('data')) key = 'dc'
      const risk = (predResult.risk ?? '').toLowerCase()
      if (key) {
        statuses[key] =
          risk === 'critical' || risk === 'high' ? 'critical' :
          risk === 'medium' ? 'warning' : statuses[key]
      }
    }

    return statuses
  }, [predResult, liveTelemetry])

  /* 2. Live link metrics labels */
  const linkMetrics = useMemo(() => {
    const metrics = {}
    LINKS.forEach(l => { metrics[l.id] = null })

    if (liveTelemetry?.site) {
      const site = liveTelemetry.site.toLowerCase()
      let activeKey = null
      if (site.includes('branch a')) activeKey = 'bra'
      else if (site.includes('branch b')) activeKey = 'brb'
      else if (site.includes('branch c')) activeKey = 'brc'
      else if (site.includes('dc') || site.includes('data')) activeKey = 'dc'

      const lat  = parseFloat(liveTelemetry.latency_ms ?? 0)
      const loss = parseFloat(liveTelemetry.packet_loss_pct ?? 0)
      const label = `${lat.toFixed(1)}ms / ${loss.toFixed(1)}%`

      if (activeKey) {
        const linkId = LINKS.find(l => l.from === activeKey || l.to === activeKey)?.id
        if (linkId) metrics[linkId] = label
      }
    }
    return metrics
  }, [liveTelemetry])

  /* 3. Active site key (for highlighting the node) */
  const activeSiteKey = useMemo(() => {
    if (!liveTelemetry?.site) return null
    const site = liveTelemetry.site.toLowerCase()
    if (site.includes('branch a')) return 'bra'
    if (site.includes('branch b')) return 'brb'
    if (site.includes('branch c')) return 'brc'
    if (site.includes('dc') || site.includes('data')) return 'dc'
    return null
  }, [liveTelemetry])

  /* 4. Packet animations from chat messages */
  const packets = useMemo(() => {
    const chat = deviceInfo?.chat
    if (!chat) return []

    const result = []
    const sent = parseChatMsg(chat.last_sent)
    const recv = parseChatMsg(chat.last_received)

    if (sent) result.push({ id: 'sent', ...sent, color: '#00d4ff', speed: 2200 })
    if (recv) result.push({ id: 'recv', ...recv, color: '#c084fc', speed: 2800 })

    return result
  }, [deviceInfo])

  /* 5. Live metrics text on active node */
  const activeSiteMetrics = useMemo(() => {
    if (!liveTelemetry || !activeSiteKey) return null
    const lat  = parseFloat(liveTelemetry.latency_ms ?? 0)
    const loss = parseFloat(liveTelemetry.packet_loss_pct ?? 0)
    return `${lat.toFixed(1)}ms · ${loss.toFixed(2)}% loss`
  }, [liveTelemetry, activeSiteKey])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{`
        @keyframes topo-pulse {
          0%,100% { opacity: 0.15; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(1.08); }
        }
      `}</style>

      <svg
        viewBox="0 0 600 360"
        width="100%"
        height="100%"
        style={{ overflow: 'visible' }}
      >
        {/* ── Background grid dots ── */}
        <defs>
          <pattern id="topo-grid" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#1a2744" />
          </pattern>
        </defs>
        <rect width="600" height="360" fill="url(#topo-grid)" />

        {/* ── Links ── */}
        {LINKS.map(link => {
          const a = NODES[link.from]
          const b = NODES[link.to]
          const metrics = linkMetrics[link.id]
          const isActive = !!metrics

          // midpoint for label
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2

          return (
            <g key={link.id}>
              {/* Main wire */}
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isActive ? '#3b82f6' : '#1e3560'}
                strokeWidth={isActive ? 2 : 1.5}
                strokeDasharray={isActive ? 'none' : '5,4'}
                style={{ transition: 'stroke 0.5s' }}
              />
              {/* Metrics label */}
              {metrics && (
                <g>
                  <rect
                    x={mx - 28} y={my - 9} width={56} height={14}
                    rx={4} fill="#0d1b35" stroke="#2a4070" strokeWidth={0.8}
                  />
                  <text
                    x={mx} y={my}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={7} fill="#7ab8ff"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {metrics}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* ── Packet animations (chat-driven) ── */}
        {packets.map(p => {
          const pathDef = buildPath(p.from, p.to)
          if (!pathDef) return null
          return (
            <PacketDot
              key={p.id}
              pathDef={pathDef}
              color={p.color}
              speed={p.speed}
            />
          )
        })}

        {/* ── Nodes ── */}
        {Object.keys(NODES).map(k => (
          <TopoNode
            key={k}
            nodeKey={k}
            status={nodeStatuses[k]}
            isActive={k === activeSiteKey}
            metrics={k === activeSiteKey ? activeSiteMetrics : null}
          />
        ))}

        {/* ── Legend ── */}
        <g transform="translate(8, 340)">
          {[
            { color: '#00d4ff', label: 'Sent packet' },
            { color: '#c084fc', label: 'Recv packet' },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(${i * 100}, 0)`}>
              <circle cx={5} cy={5} r={4} fill={item.color} opacity={0.8} />
              <text x={13} y={9} fontSize={8} fill="#7a99cc" fontFamily="Inter, sans-serif">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}
