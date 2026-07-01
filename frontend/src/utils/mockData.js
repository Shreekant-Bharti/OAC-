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

// ── Hub-and-spoke topology: Intelligent Hub ─── Branches A/B/C + DataCentre ──
export const TOPOLOGY_NODES_INIT = [
  // Central Intelligent Hub
  { id: 'hub',   label: 'Intelligent Hub', type: 'hub',    status: 'healthy',  ip: '10.0.0.1',    x: 300, y: 200 },
  // DataCentre
  { id: 'dc',    label: 'DataCentre',      type: 'dc',     status: 'healthy',  ip: '10.0.3.1',    x: 300, y: 40  },
  // Branches
  { id: 'br-a',  label: 'Branch A',        type: 'branch', status: 'healthy',  ip: '192.168.1.10', x: 60,  y: 360 },
  { id: 'br-b',  label: 'Branch B',        type: 'branch', status: 'critical', ip: '192.168.1.20', x: 300, y: 420 },
  { id: 'br-c',  label: 'Branch C',        type: 'branch', status: 'warning',  ip: '192.168.1.30', x: 540, y: 360 },
]

export const TOPOLOGY_EDGES_INIT = [
  // Hub ↔ DataCentre
  { id: 'e-hub-dc',  source: 'hub',  target: 'dc',   label: '5ms / 0.02%'   },
  // Hub ↔ Branches
  { id: 'e-hub-bra', source: 'hub',  target: 'br-a', label: '18ms / 0.1%'   },
  { id: 'e-hub-brb', source: 'hub',  target: 'br-b', label: '72ms / 4.0%', animated: true },
  { id: 'e-hub-brc', source: 'hub',  target: 'br-c', label: '35ms / 1.2%'   },
]
