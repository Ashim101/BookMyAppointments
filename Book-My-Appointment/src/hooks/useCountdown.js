import { useCallback, useEffect, useState } from 'react'

export function useCountdown(initialSeconds = 0) {
  const [remaining, setRemaining] = useState(initialSeconds)

  useEffect(() => {
    if (remaining <= 0) return undefined
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  const restart = useCallback((seconds) => setRemaining(seconds), [])
  return [remaining, restart]
}
