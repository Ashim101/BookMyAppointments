import { useCallback, useState } from 'react'

const KEY = 'bma.patient.recentSearches'
const MAX = 5

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function useRecentSearches() {
  const [items, setItems] = useState(read)

  const remember = useCallback((term) => {
    const value = term.trim()
    if (!value) return
    setItems((current) => {
      const next = [value, ...current.filter((s) => s.toLowerCase() !== value.toLowerCase())].slice(0, MAX)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Recent searches are a convenience only.
      }
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setItems([])
    try {
      localStorage.removeItem(KEY)
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }, [])

  return { items, remember, clear }
}
