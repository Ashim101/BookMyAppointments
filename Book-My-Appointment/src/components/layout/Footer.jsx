import { Link } from 'react-router-dom'
import { BRAND, SUPPORT_EMAIL, SUPPORT_PHONE } from '../../lib/config'
import Logo from '../illustrations/Logo'

const COLUMNS = [
  {
    title: 'Patients',
    links: [
      { to: '/doctors', label: 'Find a doctor' },
      { to: '/my-appointments', label: 'My appointments' },
      { to: '/profile', label: 'My profile' },
      { to: '/notifications', label: 'Notifications' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About us' },
      { to: '/contact', label: 'Contact' },
      { to: '/login', label: 'Sign in' },
      { to: '/register', label: 'Create account' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="no-print mt-16 border-t border-slate-200 bg-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-ink-500">
            Find a doctor you trust, pick a time that suits you and manage every visit in one place.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold text-ink-900">{column.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {column.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-ink-500 hover:text-brand-700 hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-slate-100 py-4">
        <div className="container-page flex flex-col justify-between gap-2 text-xs text-ink-500 sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} {BRAND}. All rights reserved.
          </p>
          <p>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">
              {SUPPORT_EMAIL}
            </a>{' '}
            &middot; {SUPPORT_PHONE}
          </p>
        </div>
      </div>
    </footer>
  )
}
