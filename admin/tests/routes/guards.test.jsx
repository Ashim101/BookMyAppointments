import { Route, Routes, useLocation } from 'react-router-dom'
import { screen } from '@testing-library/react'
import { GuestOnly, HomeRedirect, RequireRole } from '../../src/routes/guards'
import { renderWithProviders } from '../helpers/render'

function Where() {
  const { pathname, state } = useLocation()
  return <p data-testid="where">{pathname + (state?.from ? ` from=${state.from}` : '')}</p>
}

const tree = (
  <Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route element={<GuestOnly />}>
      <Route path="/login" element={<h1>Login page</h1>} />
    </Route>
    <Route path="/admin" element={<RequireRole role="admin" />}>
      <Route index element={<h1>Admin home</h1>} />
      <Route path="doctors" element={<h1>Admin doctors</h1>} />
    </Route>
    <Route path="/doctor" element={<RequireRole role="doctor" />}>
      <Route index element={<h1>Doctor home</h1>} />
    </Route>
    <Route path="*" element={<Where />} />
  </Routes>
)

describe('role guards', () => {
  it('sends signed-out visitors to login and remembers where they were going', () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<Where />} />
        <Route path="/admin/*" element={<RequireRole role="admin" />} />
      </Routes>,
      { route: '/admin/doctors?page=2' },
    )
    expect(screen.getByTestId('where')).toHaveTextContent('/login from=/admin/doctors?page=2')
  })

  it('lets an admin into /admin', () => {
    renderWithProviders(tree, { role: 'admin', route: '/admin/doctors' })
    expect(screen.getByRole('heading', { name: 'Admin doctors' })).toBeInTheDocument()
  })

  it('lets a doctor into /doctor', () => {
    renderWithProviders(tree, { role: 'doctor', route: '/doctor' })
    expect(screen.getByRole('heading', { name: 'Doctor home' })).toBeInTheDocument()
  })

  it('redirects a doctor away from /admin to the doctor home', () => {
    renderWithProviders(tree, { role: 'doctor', route: '/admin' })
    expect(screen.getByRole('heading', { name: 'Doctor home' })).toBeInTheDocument()
    expect(screen.queryByText('Admin home')).not.toBeInTheDocument()
  })

  it('redirects an admin away from /doctor to the admin home', () => {
    renderWithProviders(tree, { role: 'admin', route: '/doctor' })
    expect(screen.getByRole('heading', { name: 'Admin home' })).toBeInTheDocument()
  })

  it('keeps signed-in users out of the login page', () => {
    renderWithProviders(tree, { role: 'doctor', route: '/login' })
    expect(screen.getByRole('heading', { name: 'Doctor home' })).toBeInTheDocument()
  })

  it('shows login to guests and routes / by role', () => {
    const guest = renderWithProviders(tree, { route: '/login' })
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument()
    guest.unmount()
    renderWithProviders(tree, { role: 'admin', route: '/' })
    expect(screen.getByRole('heading', { name: 'Admin home' })).toBeInTheDocument()
  })

  it('sends / to login for guests', () => {
    renderWithProviders(tree, { route: '/' })
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument()
  })
})
