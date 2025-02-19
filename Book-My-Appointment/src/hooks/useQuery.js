import { useCallback, useEffect, useRef, useState } from 'react'

export function useQuery(key, fetcher, { enabled = true } = {}) {
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const [version, setVersion] = useState(0)
  const serialKey = JSON.stringify(key)

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))
    fetcherRef.current().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error) => !cancelled && setState({ data: null, error, loading: false }),
    )
    return () => {
      cancelled = true
    }
  }, [serialKey, version, enabled])

  const refetch = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, refetch }
}

export function useAction(action) {
  const actionRef = useRef(action)
  actionRef.current = action
  const [loading, setLoading] = useState(false)

  const run = useCallback(async (...args) => {
    setLoading(true)
    try {
      return await actionRef.current(...args)
    } finally {
      setLoading(false)
    }
  }, [])

  return { run, loading }
}
