import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { FiMenu, FiX } from 'react-icons/fi'
import { selectIsAuthenticated } from '../../features/auth/authSlice'
import { useNotificationPolling } from '../../features/notifications/useNotificationPolling'
import Logo from '../illustrations/Logo'
import NotificationBell from '../notifications/NotificationBell'
import { ButtonLink } from '../ui/Button'
import { cx } from '../ui/cx'
import UserMenu from './UserMenu'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/doctors', label: 'Find doctors' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

const linkClass = ({ isActive }) =>
  cx('rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-slate-100')

export default function Navbar() {
  const authenticated = useSelector(selectIsAuthenticated)
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  useNotificationPolling()

  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" aria-label="BookMyAppointments home" className="rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {authenticated ? (
            <>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <ButtonLink to="/login" size="sm" className="hidden sm:inline-flex">
              Sign in
            </ButtonLink>
          )}
          <button
            type="button"
            className="rounded-lg p-2 text-ink-700 hover:bg-slate-100 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-nav" aria-label="Mobile" className="container-page flex flex-col gap-1 pb-4 md:hidden">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          {!authenticated && (
            <ButtonLink to="/login" className="mt-2">
              Sign in
            </ButtonLink>
          )}
        </nav>
      )}
    </header>
  )
}
