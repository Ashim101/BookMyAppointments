import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { messageFor } from '../lib/errorCodes'

/**
 * Loads data with `fetcher` whenever `deps` change. Out-of-order responses are
 * discarded so the latest request always wins.
 */
export function useFetch(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const fetcherRef = useRef(fetcher)
  const requestId = useRef(0)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const run = useCallback(async () => {
    const id = ++requestId.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fetcherRef.current()
      if (id === requestId.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (id === requestId.current) setState((s) => ({ ...s, error, loading: false }))
    }
  }, [])

  useEffect(() => {
    if (enabled) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps])

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }))
  }, [])

  return { ...state, reload: run, setData }
}

/** Wraps a mutation: tracks the pending flag and reports failures with a toast. */
export function useMutation(fn, { success } = {}) {
  const [pending, setPending] = useState(false)
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn
  })

  const run = useCallback(
    async (...args) => {
      setPending(true)
      try {
        const result = await fnRef.current(...args)
        if (success) toast.success(typeof success === 'function' ? success(result) : success)
        return { ok: true, data: result }
      } catch (error) {
        toast.error(messageFor(error))
        return { ok: false, error }
      } finally {
        setPending(false)
      }
    },
    [success],
  )

  return { run, pending }
}
