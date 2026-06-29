// Utility: format numbers, bytes, dates, risk colours
export const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export const formatNumber = (n, decimals = 1) => {
  if (n === undefined || n === null) return '—'
  return Number(n).toFixed(decimals)
}

export const formatTime = (date = new Date()) =>
  date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const formatDate = (date = new Date()) =>
  date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export const riskColor = (risk) => {
  switch ((risk || '').toLowerCase()) {
    case 'critical': return '#ff3b3b'
    case 'high':     return '#ff8c00'
    case 'medium':   return '#ffd700'
    case 'low':
    case 'normal':   return '#00e676'
    default:         return '#7a99cc'
  }
}

export const riskBg = (risk) => {
  switch ((risk || '').toLowerCase()) {
    case 'critical': return 'rgba(255,59,59,0.12)'
    case 'high':     return 'rgba(255,140,0,0.12)'
    case 'medium':   return 'rgba(255,215,0,0.12)'
    case 'low':
    case 'normal':   return 'rgba(0,230,118,0.12)'
    default:         return 'rgba(122,153,204,0.1)'
  }
}

export const conditionLabel = (condition) => {
  const map = {
    Normal: 'Normal', Warning: 'Warning',
    'High Risk': 'High Risk', Critical: 'Critical', Failure: 'Failure',
  }
  return map[condition] || condition || '—'
}

export const riskGradient = (risk) => {
  switch ((risk || '').toLowerCase()) {
    case 'critical': return 'from-red-900/20 to-red-950/10 border-red-700/30'
    case 'high':     return 'from-orange-900/20 to-orange-950/10 border-orange-700/30'
    case 'medium':   return 'from-yellow-900/20 to-yellow-950/10 border-yellow-700/30'
    default:         return 'from-green-900/20 to-green-950/10 border-green-700/30'
  }
}

export const generateSparkline = (base, variance, length = 20) =>
  Array.from({ length }, (_, i) => ({
    t: i,
    v: Math.max(0, base + (Math.random() - 0.5) * variance * 2),
  }))

export const tsLabel = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
