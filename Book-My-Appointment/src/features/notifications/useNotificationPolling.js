import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NOTIFICATION_POLL_MS } from '../../lib/config'
import { selectIsAuthenticated } from '../auth/authSlice'
import { fetchRecent } from './notificationsSlice'

export function useNotificationPolling() {
  const dispatch = useDispatch()
  const authenticated = useSelector(selectIsAuthenticated)

  useEffect(() => {
    if (!authenticated) return undefined
    let timer = null
    const poll = () => dispatch(fetchRecent())
    const start = () => {
      if (timer) return
      poll()
      timer = setInterval(poll, NOTIFICATION_POLL_MS)
    }
    const stop = () => {
      clearInterval(timer)
      timer = null
    }
    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start())

    if (document.visibilityState !== 'hidden') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [authenticated, dispatch])
}
