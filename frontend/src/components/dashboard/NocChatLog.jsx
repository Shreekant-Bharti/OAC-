import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MdRadio, MdArrowForward } from 'react-icons/md'

/* ─── ID → Friendly name mapping ─────────────────────────── */
const ID_MAP = {
  b1: 'Branch A',
  b2: 'Branch B',
  b3: 'Branch C',
  dc: 'DataCentre',
  esp32: 'ESP32-MASTER',
  hub: 'I-Hub',
}

function resolveName(id = '') {
  return ID_MAP[id.toLowerCase()] ?? id.toUpperCase()
}

/**
 * Parse "[B1 to B2] some message" → { from, to, fromName, toName, text }
 * Returns null if no match.
 */
function parseMsg(raw) {
  if (!raw) return null
  const m = raw.match(/^\[([A-Z0-9]+)\s+to\s+([A-Z0-9]+)\]\s*(.*)/i)
  if (!m) return null
  return {
    from: m[1],
    to: m[2],
    fromName: resolveName(m[1]),
    toName: resolveName(m[2]),
    text: m[3].trim() || '—',
  }
}

/* ─── Single chat message row ─────────────────────────────── */
function ChatRow({ entry }) {
  const isSent = entry.direction === 'sent'
  return (
    <motion.div
      initial={{ opacity: 0, x: isSent ? 10 : -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col gap-0.5 px-2 py-1.5 rounded-lg border text-[10px] ${isSent
          ? 'bg-sky-500/8 border-sky-500/20 self-end'
          : 'bg-violet-500/8 border-violet-500/20 self-start'
        } w-full`}
    >
      {/* Route header */}
      <div className="flex items-center gap-1 text-[9px] font-mono">
        <span className={isSent ? 'text-sky-400 font-bold' : 'text-violet-400 font-bold'}>
          {entry.fromName}
        </span>
        <MdArrowForward className={isSent ? 'text-sky-400' : 'text-violet-400'} />
        <span className={isSent ? 'text-sky-300' : 'text-violet-300'}>
          {entry.toName}
        </span>
        <span className="ml-auto text-noc-textDim opacity-60">{entry.time}</span>
        <span className={`text-[8px] px-1 rounded ${isSent ? 'bg-sky-500/15 text-sky-400' : 'bg-violet-500/15 text-violet-400'
          }`}>
          {isSent ? 'SENT' : 'RECV'}
        </span>
      </div>
      {/* Message body */}
      <p className="text-noc-textSec leading-snug pl-0.5">{entry.text}</p>
    </motion.div>
  )
}

/* ─── Main Component ──────────────────────────────────────── */
/**
 * NocChatLog reads chat from deviceInfo.chat (full ESP32 payload).
 * This is passed from Dashboard which calls useWebSocket() at the top level.
 */
export default function NocChatLog({ deviceInfo, maxHeight = 300 }) {
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)

  // Parse new chat messages whenever deviceInfo.chat changes
  useEffect(() => {
    const chat = deviceInfo?.chat
    if (!chat) return

    const now = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })

    setMessages(prev => {
      const next = [...prev]

      // Process last_sent
      const sent = parseMsg(chat.last_sent)
      if (sent) {
        const last = prev.findLast?.(m => m.direction === 'sent')
        const isDuplicate = last && last.text === sent.text && last.fromName === sent.fromName
        if (!isDuplicate) {
          next.push({ ...sent, direction: 'sent', time: now, id: `sent-${Date.now()}` })
        }
      }

      // Process last_received
      const recv = parseMsg(chat.last_received)
      if (recv) {
        const last = prev.findLast?.(m => m.direction === 'recv')
        const isDuplicate = last && last.text === recv.text && last.fromName === recv.fromName
        if (!isDuplicate) {
          next.push({ ...recv, direction: 'recv', time: now, id: `recv-${Date.now() + 1}` })
        }
      }

      // Keep the last 60 messages
      return next.slice(-60)
    })
  }, [deviceInfo])

  const containerRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="noc-card flex flex-col gap-2" style={{ minHeight: 220, maxHeight: 300 }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-noc-border/40 pb-2 flex-shrink-0">
        <MdRadio className="text-noc-cyan text-base" />
        <span className="section-title mb-0">NOC Comms Feed</span>
        <span className="ml-auto text-[9px] font-mono text-noc-textDim">
          {messages.length} msg{messages.length !== 1 ? 's' : ''}
        </span>
        {/* Live pulse */}
        <span className="flex items-center gap-1 text-[9px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      </div>

      {/* Message list */}
      <div ref={containerRef} className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-0.5 scrollbar-thin" style={{ maxHeight }}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[10px] text-noc-textDim py-4">
            Waiting for transmissions…
          </div>
        ) : (
          messages.map(entry => (
            <ChatRow key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  )
}
