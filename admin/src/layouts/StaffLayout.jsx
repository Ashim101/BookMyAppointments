import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Outlet } from 'react-router-dom'
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi'
import Logo from '../components/Logo'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import { selectUser, signOut } from '../features/auth/authSlice'

/** Sidebar + topbar shell. `nav` is `[{ to, label, icon, end? }]`; `topbarExtra` renders beside the user menu. */
export default function StaffLayout({ nav, topbarExtra }) {
  const [open, setOpen] = useState(false)
  const user = useSelector(selectUser)
  const dispatch = useDispatch()

  const links = (
    <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="no-print hidden w-60 shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="px-5 py-5">
          <Logo light />
        </div>
        {links}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="relative flex w-64 flex-col bg-slate-900">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo light />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="text-slate-300">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            {links}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            <FiMenu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            {topbarExtra}
            <div className="flex items-center gap-2">
              <Avatar name={user?.name} src={user?.image} size="sm" />
              <div className="hidden text-right leading-tight sm:block">
                <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                <p className="text-xs capitalize text-slate-500">{user?.role}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => dispatch(signOut())}>
              <FiLogOut aria-hidden="true" /> Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
