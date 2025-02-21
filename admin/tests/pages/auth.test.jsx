import { Route, Routes } from 'react-router-dom'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from '../../src/pages/Login'
import ForgotPassword from '../../src/pages/ForgotPassword'
import ResetPassword from '../../src/pages/ResetPassword'
import { fail, mockHttp, ok, session } from '../helpers/http'
import { renderWithProviders } from '../helpers/render'

const loginTree = (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/admin" element={<h1>Admin home</h1>} />
    <Route path="/doctor" element={<h1>Doctor home</h1>} />
  </Routes>
)

describe('Login', () => {
  it('validates before calling the API', async () => {
    const user = userEvent.setup()
    const calls = mockHttp(() => ok(session()))
    renderWithProviders(loginTree, { route: '/login' })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('sends the selected role and lands on the matching home', async () => {
    const user = userEvent.setup()
    const calls = mockHttp(() => ok(session()))
    renderWithProviders(loginTree, { route: '/login' })
    await user.click(screen.getByRole('radio', { name: 'Doctor' }))
    await user.type(screen.getByLabelText('Email'), 'who@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Doctor home' })).toBeInTheDocument()
    expect(JSON.parse(calls[0].data)).toEqual({ email: 'who@example.com', password: 'secret123', role: 'doctor' })
  })

  it('shows the server message for bad credentials', async () => {
    const user = userEvent.setup()
    mockHttp(() => fail(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.'))
    renderWithProviders(loginTree, { route: '/login' })
    await user.type(screen.getByLabelText('Email'), 'a@b.io')
    await user.type(screen.getByLabelText('Password'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
  })

  it('offers password recovery for doctors only', async () => {
    const user = userEvent.setup()
    renderWithProviders(loginTree, { route: '/login' })
    expect(screen.queryByText('Forgot your password?')).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Doctor' }))
    expect(screen.getByText('Forgot your password?')).toBeInTheDocument()
  })
})

describe('ForgotPassword', () => {
  it('requests a doctor reset and confirms without revealing account existence', async () => {
    const user = userEvent.setup()
    const calls = mockHttp(() => ok(null))
    renderWithProviders(<ForgotPassword />)
    await user.type(screen.getByLabelText('Email'), 'who@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
    expect(calls[0].url).toBe('/auth/password/forgot')
    expect(JSON.parse(calls[0].data)).toEqual({ email: 'who@example.com', role: 'doctor' })
  })

  it('rejects an invalid email locally', async () => {
    const user = userEvent.setup()
    const calls = mockHttp(() => ok(null))
    renderWithProviders(<ForgotPassword />)
    await user.type(screen.getByLabelText('Email'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })
})

describe('ResetPassword', () => {
  const tree = (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login" element={<h1>Login page</h1>} />
    </Routes>
  )

  it('rejects links without a token or doctor role', () => {
    renderWithProviders(tree, { route: '/reset-password?role=doctor' })
    expect(screen.getByRole('alert')).toHaveTextContent('invalid')
  })

  it('validates the password and the confirmation', async () => {
    const user = userEvent.setup()
    const calls = mockHttp(() => ok(null))
    renderWithProviders(tree, { route: '/reset-password?token=t0k&role=doctor' })
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('submits the token and returns to login', async () => {
    const user = userEvent.setup()
    const calls = mockHttp(() => ok(null))
    renderWithProviders(tree, { route: '/reset-password?token=t0k&role=doctor' })
    await user.type(screen.getByLabelText('New password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument()
    expect(JSON.parse(calls[0].data)).toEqual({ token: 't0k', password: 'newpass123' })
  })

  it('shows the server error for an expired token', async () => {
    const user = userEvent.setup()
    mockHttp(() => fail(400, 'BAD_REQUEST', 'Reset link has expired'))
    renderWithProviders(tree, { route: '/reset-password?token=t0k&role=doctor' })
    await user.type(screen.getByLabelText('New password'), 'newpass123')
    await user.type(screen.getByLabelText('Confirm password'), 'newpass123')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Reset link has expired'))
  })
})
