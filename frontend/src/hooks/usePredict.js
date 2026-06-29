import { useState, useCallback } from 'react'
import { predict as apiPredict } from '../services/api'
import toast from 'react-hot-toast'

export function usePredict() {
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const run = useCallback(async (telemetry) => {
    setLoading(true)
    setError(null)
    const toastId = toast.loading('Running ML prediction…')
    try {
      const data = await apiPredict(telemetry)
      setResult(data)
      toast.success(`Prediction complete — Risk: ${data.risk}`, { id: toastId })
      return data
    } catch (e) {
      let msg = 'An unexpected error occurred.'
      if (e.message.includes('timeout')) msg = 'Request timed out. The ML Engine is taking too long.'
      else if (e.message.includes('Network Error')) msg = 'Backend offline. Please check your network connection or server status.'
      else if (e.message) msg = `Error: ${e.message}`
      
      setError(msg)
      toast.error(msg, { id: toastId })
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { result, loading, error, run }
}
