import { useMemo } from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { generateChartHistory } from '../../utils/mockData'

const CHART_STYLE = {
  background: 'transparent',
  borderRadius: 8,
}

const TooltipStyle = {
  contentStyle: { background: '#111827', border: '1px solid #1a2744', borderRadius: 8, padding: '8px 12px' },
  labelStyle:   { color: '#7a99cc', fontSize: 11 },
  itemStyle:    { fontSize: 11 },
}

function ChartCard({ title, children, live = true }) {
  return (
    <div className="noc-card-glow flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="section-title mb-0">{title}</p>
        {live && (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-noc-green animate-pulse" />
            <span className="text-[9px] text-noc-green">Live</span>
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export function LatencyChart({ data }) {
  const hist = useMemo(() => data || generateChartHistory(20), [data])
  const chartData = hist.labels
    ? hist.labels.map((t, i) => ({ t, v: hist.latency[i] }))
    : hist

  return (
    <ChartCard title="Latency (ms)">
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={chartData} style={CHART_STYLE}>
          <defs>
            <linearGradient id="grad-lat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#00d4ff" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1a2744" />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#7a99cc' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#7a99cc' }} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...TooltipStyle} />
          <Area type="monotone" dataKey="v" stroke="#00d4ff" fill="url(#grad-lat)" strokeWidth={1.5} dot={false} name="Latency ms" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function PacketLossChart({ data }) {
  const hist = useMemo(() => data || generateChartHistory(20), [data])
  const chartData = hist.labels
    ? hist.labels.map((t, i) => ({ t, v: hist.packetLoss[i] }))
    : hist

  return (
    <ChartCard title="Packet Loss (%)">
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={chartData} style={CHART_STYLE}>
          <defs>
            <linearGradient id="grad-pl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#ff8c00" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ff8c00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1a2744" />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#7a99cc' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#7a99cc' }} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...TooltipStyle} />
          <Area type="monotone" dataKey="v" stroke="#ff8c00" fill="url(#grad-pl)" strokeWidth={1.5} dot={false} name="Loss %" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function UtilizationChart({ data }) {
  const hist = useMemo(() => data || generateChartHistory(20), [data])
  const chartData = hist.labels
    ? hist.labels.map((t, i) => ({ t, v: hist.utilization[i] }))
    : hist

  return (
    <ChartCard title="Utilization (%)">
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={chartData} style={CHART_STYLE}>
          <defs>
            <linearGradient id="grad-util" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6c63ff" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6c63ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1a2744" />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#7a99cc' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: '#7a99cc' }} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...TooltipStyle} />
          <Area type="monotone" dataKey="v" stroke="#6c63ff" fill="url(#grad-util)" strokeWidth={1.5} dot={false} name="Util %" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function ConfidenceTimeline({ history }) {
  const data = history.slice(0, 20).reverse().map((h, i) => ({
    t: h.timestamp,
    v: h.confidenceScore,
    r: h.risk,
  }))

  return (
    <ChartCard title="Confidence Timeline">
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} style={CHART_STYLE}>
          <CartesianGrid vertical={false} stroke="#1a2744" />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#7a99cc' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#7a99cc' }} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...TooltipStyle} />
          <Line type="monotone" dataKey="v" stroke="#00e676" strokeWidth={1.5} dot={{ r: 2, fill: '#00e676' }} name="Confidence %" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
