import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/** Scrolls to the top and moves focus to the main region whenever the route path changes. */
export default function ScrollRestoration() {
  const { pathname } = useLocation()
  const first = useRef(true)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (first.current) first.current = false
    else document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])

  return null
}
