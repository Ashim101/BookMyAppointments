import { useEffect } from 'react'

const SUFFIX = 'BookMyAppointments Staff'

/** Keeps the browser tab title in sync with the current page for history and screen readers. */
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${SUFFIX}` : SUFFIX
  }, [title])
}
