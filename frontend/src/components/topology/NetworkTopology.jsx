import { useMemo } from 'react'
import {
  ReactFlow,
  Background, Controls, MiniMap,
  useNodesState, useEdgesState,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TOPOLOGY_NODES_INIT, TOPOLOGY_EDGES_INIT } from '../../utils/mockData'

const STATUS_COLOR = {
  healthy:  { bg: '#00e676', border: '#00b359', glow: '0 0 16px rgba(0,230,118,0.35)' },
  warning:  { bg: '#ffd700', border: '#cc9900', glow: '0 0 16px rgba(255,215,0,0.35)'  },
  critical: { bg: '#ff3b3b', border: '#cc2222', glow: '0 0 16px rgba(255,59,59,0.35)'  },
}

const TYPE_META = {
  hq:     { size: 58, icon: '🏢', ring: 3 },
  core:   { size: 52, icon: '⬡',  ring: 2 },
  dc:     { size: 48, icon: '🖥',  ring: 2 },
  router: { size: 42, icon: '⬡',  ring: 2 },
  branch: { size: 38, icon: '📡', ring: 2 },
}

function NocNode({ data }) {
  const sc = STATUS_COLOR[data.status] ?? STATUS_COLOR.healthy
  const tm = TYPE_META[data.type]    ?? TYPE_META.branch
  const sz = tm.size

  return (
    <div style={{ textAlign: 'center', userSelect: 'none' }}>
      {/* React Flow connection handles — invisible */}
      <Handle type="target" position={Position.Top}    style={{ opacity: 0, width: 1, height: 1, minWidth: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1, minWidth: 1 }} />
      <Handle type="source" position={Position.Left}   style={{ opacity: 0, width: 1, height: 1, minWidth: 1 }} id="left" />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0, width: 1, height: 1, minWidth: 1 }} id="right" />

      {/* Node circle */}
      <div
        style={{
          width: sz, height: sz, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${sc.bg}45, ${sc.bg}12)`,
          border: `${tm.ring}px solid ${sc.border}`,
          boxShadow: sc.glow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: sz * 0.38, margin: '0 auto',
          cursor: 'pointer', transition: 'transform 0.2s',
        }}
      >
        {tm.icon}
      </div>

      {/* Label */}
      <p style={{ fontSize: 10, color: '#dce8ff', marginTop: 5, fontWeight: 700, fontFamily: 'Inter,sans-serif', lineHeight: 1.2 }}>
        {data.label}
      </p>
      <p style={{ fontSize: 9, color: '#7a99cc', fontFamily: 'JetBrains Mono,monospace', marginTop: 1 }}>
        {data.ip}
      </p>

      {/* Status badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
        padding: '2px 8px', borderRadius: 10,
        background: `${sc.bg}18`, border: `1px solid ${sc.border}50`,
        fontSize: 9, color: sc.bg, fontWeight: 700, textTransform: 'capitalize',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.bg, display: 'inline-block' }} />
        {data.status}
      </div>
    </div>
  )
}

const nodeTypes = { noc: NocNode }

const RF_STYLE = {
  background: 'transparent',
}

export default function NetworkTopology({ predResult }) {

  const rawNodes = useMemo(() => TOPOLOGY_NODES_INIT.map((n) => {
    let status = n.status
    if (predResult) {
      const siteKey = (predResult.site || '').toLowerCase()
      if (n.label.toLowerCase().includes(siteKey) || n.id.toLowerCase().includes(siteKey.replace(/[^a-z0-9]/g, ''))) {
        const risk = (predResult.risk || '').toLowerCase()
        status = risk === 'critical' ? 'critical' : risk === 'high' ? 'critical' : risk === 'medium' ? 'warning' : 'healthy'
      }
    }
    return {
      id:       n.id,
      type:     'noc',
      position: { x: n.x, y: n.y },
      data:     { label: n.label, type: n.type, status, ip: n.ip },
    }
  }), [predResult])

  const rawEdges = useMemo(() => TOPOLOGY_EDGES_INIT.map((e) => ({
    id:     e.id,
    source: e.source,
    target: e.target,
    label:  e.label,
    animated: !!e.animated,
    style: {
      stroke:      e.animated ? '#ff3b3b' : '#243560',
      strokeWidth: e.animated ? 2.5 : 1.5,
    },
    labelStyle:   { fontSize: 9, fill: '#7a99cc', fontFamily: 'monospace' },
    labelBgStyle: { fill: '#0d1425', fillOpacity: 0.9 },
    markerEnd:    {
      type:   MarkerType.ArrowClosed,
      width:  12, height: 12,
      color:  e.animated ? '#ff3b3b' : '#243560',
    },
  })), [])

  const [nodes, , onNodesChange] = useNodesState(rawNodes)
  const [edges, , onEdgesChange] = useEdgesState(rawEdges)

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        style={RF_STYLE}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.4}
        maxZoom={2.5}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a2744" gap={32} size={1} />
        <Controls
          style={{
            background: '#111827', border: '1px solid #1a2744',
            borderRadius: 8, overflow: 'hidden',
          }}
          showInteractive={false}
        />
        <MiniMap
          style={{ background: '#0d1425', border: '1px solid #1a2744', borderRadius: 8 }}
          nodeColor={(n) => {
            const s = n.data?.status
            return s === 'critical' ? '#ff3b3b' : s === 'warning' ? '#ffd700' : '#00e676'
          }}
          maskColor="rgba(8,13,26,0.75)"
          nodeStrokeWidth={2}
        />
      </ReactFlow>
    </div>
  )
}
