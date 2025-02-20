import { useCallback, useState } from 'react'

const PREFIX = 'bma.staff.filters.'

function load(key, defaults) {
  try {
    const stored = JSON.parse(localStorage.getItem(PREFIX + key))
    return stored ? { ...defaults, ...stored, page: 1 } : defaults
  } catch {
    return defaults
  }
}

/**
 * Table filter state with `page` handling. Filters are remembered per table
 * in localStorage so they survive a reload; changing any filter returns to page 1.
 */
export function useFilters(key, defaults) {
  const [filters, setFilters] = useState(() => load(key, defaults))

  const update = useCallback(
    (patch) => {
      setFilters((current) => {
        const next = { ...current, ...patch }
        if (!('page' in patch)) next.page = 1
        try {
          localStorage.setItem(PREFIX + key, JSON.stringify(next))
        } catch {
          // persistence is best effort
        }
        return next
      })
    },
    [key],
  )

  const reset = useCallback(() => update({ ...defaults, page: 1 }), [update, defaults])
  const dirty = Object.keys(defaults).some((k) => k !== 'page' && filters[k] !== defaults[k])

  return { filters, update, reset, dirty }
}
