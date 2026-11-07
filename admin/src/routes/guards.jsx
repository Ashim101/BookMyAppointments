import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { homePath, selectRole } from '../features/auth/authSlice'

/** Renders child routes only for `role`. Signed-out users go to login, other roles to their own home. */
export function RequireRole({ role }) {
  const current = useSelector(selectRole)
  const location = useLocation()
  if (!current) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (current !== role) return <Navigate to={homePath(current)} replace />
  return <Outlet />
}

/** Login-style pages: signed-in users are sent to their dashboard. */
export function GuestOnly() {
  const current = useSelector(selectRole)
  return current ? <Navigate to={homePath(current)} replace /> : <Outlet />
}

export function HomeRedirect() {
  const current = useSelector(selectRole)
  return <Navigate to={current ? homePath(current) : '/login'} replace />
}
