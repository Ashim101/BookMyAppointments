import { useEffect, useRef, useState } from 'react'

export function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Calls `callback` every `interval` ms while the tab is visible, and once when it becomes visible again. */
export function usePolling(callback, interval) {
  const ref = useRef(callback)
  useEffect(() => {
    ref.current = callback
  })

  useEffect(() => {
    let timer = null
    const start = () => {
      timer ||= setInterval(() => ref.current(), interval)
    }
    const stop = () => {
      clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ref.current()
        start()
      } else {
        stop()
      }
    }
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [interval])
}
