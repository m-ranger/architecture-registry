import { useCallback, useState, useEffect } from 'react'
import type { ApiError } from './client'

export interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  /** Повторная загрузка данных (например, после создания записи) */
  refetch: () => void
}

/**
 * Custom hook for loading data from API with loading/error states
 */
export function useApi<T>(apiCall: () => Promise<T>): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await apiCall()
        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as ApiError)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const refetch = useCallback(() => setVersion((v) => v + 1), [])

  return { data, loading, error, refetch }
}
