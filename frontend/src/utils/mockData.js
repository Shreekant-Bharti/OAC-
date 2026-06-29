import { generateSparkline } from './formatters'

export const SITES = ['HQ-Mumbai', 'HQ-Delhi', 'Branch-1', 'Branch-2', 'Branch-3']

export const DEFAULT_TELEMETRY = {
  site: 'Branch-2',
  device: 'WAN-Edge-B2-01',
  latency_ms: 72.0,
  packet_loss_pct: 4.0,
  utilization_pct: 88.0,
  jitter_ms: 25.0,
  bgp_flaps: 5,
  ospf_events: 2,
  tunnel_health: 0.6,
  tunnel_uptime: 0.6,
  queue_length: 220.0,
  active_flows: 420.0,
  throughput_mbps: 850.0,
  rx_bytes: 65000000,
  tx_bytes: 58000000,
  failure_category_enc: 1,
}

export const generateChartHistory = (length = 30) => {
  const labels = Array.from({ length }, (_, i) => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - (length - i) * 5)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  })
  return {
    labels,
    latency:    Array.from({ length }, (_, i) => 18 + Math.sin(i * 0.4) * 12 + Math.random() * 8),
    packetLoss: Array.from({ length }, (_, i) => Math.max(0, 0.1 + Math.sin(i * 0.3) * 0.8 + Math.random() * 0.5)),
    utilization:Array.from({ length }, (_, i) => 45 + Math.sin(i * 0.25) * 20 + Math.random() * 10),
    jitter:     Array.from({ length }, (_, i) => 2 + Math.abs(Math.sin(i * 0.5)) * 10 + Math.random() * 4),
    confidence: Array.from({ length }, () => 85 + Math.random() * 14),
  }
}

export const MOCK_ALERTS = [
  { id: 1, level: 'critical', title: 'High Latency Predicted', site: 'Branch-2', eta: '05:42', time: '10:23 AM' },
  { id: 2, level: 'high',     title: 'Packet Loss Increasing', site: 'Branch-1 → Hub', eta: '08:15', time: '10:22 AM' },
  { id: 3, level: 'medium',   title: 'BGP Route Flap Detected', site: 'HQ-Mumbai', eta: '21:00', time: '10:21 AM' },
]

export const TOPOLOGY_NODES_INIT = [
  { id: 'hq-m',  label: 'HQ Mumbai',  type: 'hq',      status: 'healthy',  ip: '10.0.0.1',  x: 320, y: 40  },
  { id: 'pe1',   label: 'PE-MUM-01',  type: 'router',  status: 'healthy',  ip: '10.0.1.1',  x: 180, y: 160 },
  { id: 'pe2',   label: 'PE-DEL-01',  type: 'router',  status: 'warning',  ip: '10.0.2.1',  x: 460, y: 160 },
  { id: 'core',  label: 'MPLS Core',  type: 'core',    status: 'healthy',  ip: '10.0.0.2',  x: 320, y: 270 },
  { id: 'dc',    label: 'Datacenter', type: 'dc',      status: 'healthy',  ip: '10.0.3.1',  x: 320, y: 390 },
  { id: 'br1',   label: 'Branch-1',   type: 'branch',  status: 'healthy',  ip: '192.168.1.1', x: 80,  y: 460 },
  { id: 'br2',   label: 'Branch-2',   type: 'branch',  status: 'critical', ip: '192.168.1.2', x: 320, y: 510 },
  { id: 'br3',   label: 'Branch-3',   type: 'branch',  status: 'warning',  ip: '192.168.1.3', x: 560, y: 460 },
]

export const TOPOLOGY_EDGES_INIT = [
  { id: 'e1', source: 'hq-m', target: 'pe1', label: '18ms / 0.1%' },
  { id: 'e2', source: 'hq-m', target: 'pe2', label: '22ms / 0.3%' },
  { id: 'e3', source: 'pe1',  target: 'core',label: '8ms / 0.05%'  },
  { id: 'e4', source: 'pe2',  target: 'core',label: '10ms / 0.1%'  },
  { id: 'e5', source: 'core', target: 'dc',  label: '5ms / 0.02%'  },
  { id: 'e6', source: 'dc',   target: 'br1', label: '24ms / 0.2%'  },
  { id: 'e7', source: 'dc',   target: 'br2', label: '72ms / 4.0%', animated: true },
  { id: 'e8', source: 'dc',   target: 'br3', label: '35ms / 1.2%'  },
]
