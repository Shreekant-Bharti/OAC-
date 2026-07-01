import { motion, AnimatePresence } from 'framer-motion'
import {
  MdWifi, MdWifiOff, MdSyncAlt,
  MdRouter, MdTrendingUp, MdMemory, MdSignalWifi4Bar,
  MdLink, MdLinkOff,
} from 'react-icons/md'

/* ─── helpers ─────────────────────────────────────────────── */
function fmt(v, decimals = 1) {
  if (v === undefined || v === null || v === '') return '—'
  const n = parseFloat(v)
  return isNaN(n) ? String(v) : n.toFixed(decimals)
}
function fmtBytes(v) {
  if (!v && v !== 0) return '—'
  const n = parseInt(v)
  if (isNaN(n)) return String(v)
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB'
  return n + ' B'
}
function fmtUptime(sec) {
  const s = parseInt(sec ?? 0)
  if (isNaN(s)) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
}

const SLA_COLOR = {
  ok:       { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  warning:  { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  text: 'text-yellow-400',  dot: 'bg-yellow-400'  },
  critical: { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     dot: 'bg-red-400'     },
}

/* ─── MetricBadge ─────────────────────────────────────────── */
function MetricBadge({ label, value, unit = '', accent = '#00d4ff', highlight = false }) {
  return (
    <div className={`flex flex-col gap-0.5 p-2 rounded-lg border transition-all ${
      highlight ? 'bg-orange-500/10 border-orange-500/40' : 'bg-noc-surface/40 border-noc-border/50'
    }`}>
      <span className="text-[9px] text-noc-textDim uppercase tracking-wider leading-none">{label}</span>
      <span className="text-sm font-bold leading-none" style={{ color: highlight ? '#ff8c00' : accent }}>
        {value}
        {unit && <span className="text-[10px] font-normal text-noc-textDim ml-0.5">{unit}</span>}
      </span>
    </div>
  )
}

/* ─── InfoRow ─────────────────────────────────────────────── */
function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[9px] text-noc-textDim uppercase tracking-wider">{label}</span>
      <span className={`text-[10px] font-semibold text-noc-textPri ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  )
}

/* ─── Status Badge ────────────────────────────────────────── */
function StatusBadge({ status, url, lastUpdated, error }) {
  const isOk   = status === 'connected'
  const isPoll = status === 'connecting'
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="flex flex-col gap-1 items-end">
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold ${
        isOk   ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' :
        isPoll ? 'bg-yellow-500/10  border-yellow-500/40  text-yellow-400'  :
                 'bg-red-500/10     border-red-500/40     text-red-400'
      }`}>
        {isOk   ? <MdWifi className="text-sm" /> :
         isPoll ? <MdSyncAlt className="text-sm animate-spin" /> :
                  <MdWifiOff className="text-sm" />}
        {isOk ? '🟢 Live' : isPoll ? 'Polling…' : '🔴 Offline'}
        <span className="ml-1 opacity-50 font-mono text-[8px] hidden sm:inline">
          {(url || '').replace('http://', '')}
        </span>
      </div>
      {timeStr && <span className="text-[8px] text-noc-textDim">Last: {timeStr}</span>}
      {status === 'error' && error && <span className="text-[8px] text-red-400">{error}</span>}
    </div>
  )
}

/* ─── ESP32 Info Card ─────────────────────────────────────── */
function ESP32Card({ esp32 }) {
  if (!esp32) return null
  const rssi = parseInt(esp32.rssi_dbm ?? -100)
  const rssiColor = rssi >= -50 ? '#00e676' : rssi >= -70 ? '#ffd700' : '#ff3b3b'
  const heapKB = ((esp32.free_heap_bytes ?? 0) / 1024).toFixed(1)

  return (
    <div className="rounded-lg border border-noc-border/50 bg-noc-surface/30 p-2.5 space-y-1">
      <div className="flex items-center gap-1.5 mb-1.5">
        <MdSignalWifi4Bar className="text-noc-cyan text-sm" />
        <span className="text-[10px] font-bold text-noc-textSec uppercase tracking-wider">ESP32 Gateway</span>
        <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
          esp32.wifi_connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
        }`}>
          {esp32.wifi_connected ? 'WiFi ✓' : 'WiFi ✗'}
        </span>
      </div>
      <InfoRow label="STA IP"     value={esp32.sta_ip}          mono />
      <InfoRow label="AP IP"      value={esp32.ap_ip}           mono />
      <InfoRow label="RSSI"       value={<span style={{ color: rssiColor }}>{rssi} dBm</span>} />
      <InfoRow label="Free Heap"  value={`${heapKB} KB`}        mono />
      <InfoRow label="Uptime"     value={fmtUptime(esp32.uptime_sec)} />
      <InfoRow label="AP Clients" value={esp32.ap_clients ?? 0} />
    </div>
  )
}

/* ─── NRF24 Link Card ─────────────────────────────────────── */
export function NRF24Card({ nrf }) {
  if (!nrf) return null
  const hasError = (nrf.send_failures ?? 0) > 0
  return (
    <div className="rounded-lg border border-noc-border/50 bg-noc-surface/30 p-2.5 space-y-1">
      <div className="flex items-center gap-1.5 mb-1.5">
        {hasError ? <MdLinkOff className="text-red-400 text-sm" /> : <MdLink className="text-noc-cyan text-sm" />}
        <span className="text-[10px] font-bold text-noc-textSec uppercase tracking-wider">NRF24 Link</span>
        <span className="ml-auto text-[9px] font-mono text-noc-textDim">ch {nrf.channel}</span>
      </div>
      <InfoRow label="Data Rate"  value={nrf.data_rate}              mono />
      <InfoRow label="PA Level"   value={nrf.pa_level}               mono />
      <InfoRow label="Protocol"   value={nrf.protocol}               mono />
      <InfoRow label="Msgs Sent"  value={nrf.msgs_sent_to_b ?? 0}   />
      <InfoRow label="Msgs Recv"  value={nrf.msgs_received_from_b ?? 0} />
      <InfoRow label="Failures"   value={
        <span className={hasError ? 'text-red-400 font-bold' : 'text-noc-textPri'}>
          {nrf.send_failures ?? 0}
        </span>
      } />
      <InfoRow label="Last ACK"   value={nrf.last_ack ?? 'none'}     mono />
    </div>
  )
}

/* ─── Main Component ──────────────────────────────────────── */
/**
 * LiveTelemetryPanel now receives all data as props from Dashboard.
 * Dashboard calls useWebSocket() ONCE and passes data down.
 * This prevents double-polling and chat data loss.
 */
export default function LiveTelemetryPanel({ telemetry, deviceInfo, wsStatus, wsUrl, lastUpdated, error }) {
  const sla = telemetry?.sla_status?.toLowerCase?.() ?? 'ok'
  const slaStyle = SLA_COLOR[sla] ?? SLA_COLOR.ok

  return (
    <div className="noc-card flex flex-col gap-3 h-full overflow-y-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <MdRouter className="text-noc-cyan text-base" />
          <span className="section-title mb-0">Live Telemetry</span>
          <span className="text-[9px] text-noc-textDim px-1.5 py-0.5 rounded bg-noc-surface/60 border border-noc-border/50">
            HTTP · 8s poll
          </span>
        </div>
        <StatusBadge status={wsStatus} url={wsUrl} lastUpdated={lastUpdated} error={error} />
      </div>

      {/* ── No data placeholder ── */}
      <AnimatePresence mode="wait">
        {!telemetry ? (
          <motion.div
            key="no-data"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-2 py-8 text-center"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
              wsStatus !== 'error'
                ? 'bg-yellow-500/10 border-yellow-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              {wsStatus !== 'error'
                ? <MdSyncAlt className="text-yellow-400 text-xl animate-spin" />
                : <MdWifiOff className="text-red-400 text-xl" />}
            </div>
            <p className="text-[11px] text-noc-textSec">
              {wsStatus !== 'error' ? 'Polling ESP32… waiting for first frame' : `Cannot reach ${wsUrl}`}
            </p>
            {error && <p className="text-[10px] text-red-400">{error}</p>}
          </motion.div>

        ) : (
          <motion.div
            key="data"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
          >
            {/* ── Identity row ── */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-noc-textDim uppercase text-[8px] tracking-wider">Site</span>
                <span className="font-bold text-[11px] text-noc-cyan">{telemetry.site ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-noc-textDim uppercase text-[8px] tracking-wider">Interface</span>
                <span className="font-bold text-[11px] text-noc-textPri">{telemetry.interface ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-noc-textDim uppercase text-[8px] tracking-wider">Link ID</span>
                <span className="font-mono text-[11px] text-noc-textSec">{telemetry.link_id ?? '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-noc-textDim uppercase text-[8px] tracking-wider">Timestamp</span>
                <span className="font-mono text-[10px] text-noc-textSec">{telemetry.timestamp ?? '—'}</span>
              </div>
            </div>

            {/* ── SLA banner ── */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${slaStyle.bg} ${slaStyle.border}`}>
              <span className={`w-2 h-2 rounded-full ${slaStyle.dot} animate-pulse flex-shrink-0`} />
              <span className={`text-[10px] font-bold uppercase ${slaStyle.text}`}>
                SLA: {telemetry.sla_status ?? 'OK'}
              </span>
              <span className="ml-auto text-[9px] text-noc-textDim font-mono">{telemetry.date ?? ''}</span>
            </div>

            {/* ── Core metrics grid ── */}
            <div className="grid grid-cols-2 gap-1.5">
              <MetricBadge label="Utilization"   value={fmt(telemetry.utilization_pct)}    unit="%"    accent="#00d4ff" highlight={parseFloat(telemetry.utilization_pct) > 85} />
              <MetricBadge label="Packet Loss"   value={fmt(telemetry.packet_loss_pct, 2)} unit="%"    accent="#00e676" highlight={parseFloat(telemetry.packet_loss_pct) > 5} />
              <MetricBadge label="Latency"       value={fmt(telemetry.latency_ms)}         unit="ms"   accent="#6c63ff" highlight={parseFloat(telemetry.latency_ms) > 60} />
              <MetricBadge label="Jitter"        value={fmt(telemetry.jitter_ms)}          unit="ms"   accent="#ffd700" highlight={parseFloat(telemetry.jitter_ms) > 30} />
              <MetricBadge label="Throughput"    value={fmt(telemetry.throughput_mbps)}    unit="Mbps" accent="#00b4d8" />
              <MetricBadge label="Queue"         value={fmt(telemetry.queue_length, 0)}    unit=""     accent="#a855f7" highlight={parseFloat(telemetry.queue_length) > 250} />
              <MetricBadge label="Active Flows"  value={fmt(telemetry.active_flows, 0)}   unit=""     accent="#f472b6" />
              <MetricBadge label="Tunnel Uptime" value={fmtUptime(telemetry.tunnel_uptime)} unit=""   accent="#34d399" />
            </div>

            {/* ── RX / TX bytes ── */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-2 p-2 rounded-lg border border-noc-border/50 bg-noc-surface/30">
                <MdTrendingUp className="text-emerald-400 text-sm flex-shrink-0" />
                <div>
                  <p className="text-[8px] text-noc-textDim uppercase">RX Bytes</p>
                  <p className="text-xs font-bold text-emerald-400">{fmtBytes(telemetry.rx_bytes)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg border border-noc-border/50 bg-noc-surface/30">
                <MdTrendingUp className="text-sky-400 text-sm flex-shrink-0 rotate-180" />
                <div>
                  <p className="text-[8px] text-noc-textDim uppercase">TX Bytes</p>
                  <p className="text-xs font-bold text-sky-400">{fmtBytes(telemetry.tx_bytes)}</p>
                </div>
              </div>
            </div>

            {/* ── ESP32 device info ── */}
            {deviceInfo && (
              <ESP32Card esp32={deviceInfo.esp32} />
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
