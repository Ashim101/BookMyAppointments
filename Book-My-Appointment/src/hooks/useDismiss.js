import { useEffect, useRef } from 'react'

/** Calls `onDismiss` on an outside pointer press or Escape while `open` is true. */
export function useDismiss(open, onDismiss) {
  const ref = useRef(null)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) dismissRef.current()
    }
    const onKey = (event) => event.key === 'Escape' && dismissRef.current()
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return ref
}
