import { useSelector } from 'react-redux'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectIsAuthenticated } from '../features/auth/authSlice'

export default function ProtectedRoute() {
  const authenticated = useSelector(selectIsAuthenticated)
  const { pathname, search } = useLocation()
  if (!authenticated) return <Navigate to="/login" replace state={{ from: `${pathname}${search}` }} />
  return <Outlet />
}
