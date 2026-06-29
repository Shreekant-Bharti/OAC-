import { useState, useEffect, useCallback } from 'react'
import { getHealth } from '../services/api'

export function useHealth(intervalMs = 10000) {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [online, setOnline] = useState(false)

  const fetch = useCallback(async () => {
    try {
      const data = await getHealth()
      setHealth(data)
      setOnline(data.status === 'ok')
      setError(null)
    } catch (e) {
      setError(e.message)
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => clearInterval(id)
  }, [fetch, intervalMs])

  return { health, loading, error, online, refetch: fetch }
}
