import { useState, useCallback } from 'react'
import { predict as apiPredict } from '../services/api'
import toast from 'react-hot-toast'

export function usePredict() {
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  /**
   * run(telemetry, options)
   *  options.silent = true  → no loading spinner, no toast — just silently updates `result`
   *  options.silent = false → full UI feedback (spinner + toast)
   */
  const run = useCallback(async (telemetry, options = {}) => {
    const { silent = false } = options
    setError(null)

    if (!silent) setLoading(true)
    const toastId = silent ? null : toast.loading('Running ML prediction…')

    try {
      const data = await apiPredict(telemetry)
      setResult(data)
      if (!silent && toastId) {
        toast.success(`Prediction — Risk: ${data.risk}`, { id: toastId })
      }
      return data
    } catch (e) {
      let msg = 'An unexpected error occurred.'
      if (e.message?.includes('timeout'))      msg = 'Request timed out.'
      else if (e.message?.includes('Network')) msg = 'Backend offline.'
      else if (e.message)                      msg = `Error: ${e.message}`

      setError(msg)
      if (!silent && toastId) toast.error(msg, { id: toastId })
      return null
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  return { result, loading, error, run }
}
