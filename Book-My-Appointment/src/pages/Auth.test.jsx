import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'react-toastify'
import { describe, expect, it, vi } from 'vitest'
import { session } from '../test/factories'
import { bodyOf, fail, mockApi, ok } from '../test/http'
import { currentLocation, renderApp } from '../test/render'
import ForgotPassword from './ForgotPassword'
import Login from './Login'
import ResetPassword from './ResetPassword'

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

describe('login', () => {
  const open = (route = '/login') => renderApp(<Login />, { route, path: '/login', loggedIn: false })

  it('validates before calling the API', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(session))
    open()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Email is required')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('signs in as a patient and stores the session', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(session))
    const { store } = open()
    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.type(screen.getByLabelText('Password'), 'goodpass1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(store.getState().auth.tokens).toEqual(session))
    expect(bodyOf(calls[0])).toEqual({ email: 'asha@example.com', password: 'goodpass1', role: 'patient' })
    expect(currentLocation(screen)).toBe('/')
  })

  it('toasts a friendly message for bad credentials', async () => {
    const user = userEvent.setup()
    mockApi(() => fail(401, 'INVALID_CREDENTIALS'))
    const { store } = open()
    await user.type(screen.getByLabelText('Email'), 'asha@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpass1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The email or password is incorrect.'))
    expect(store.getState().auth.tokens).toBeNull()
  })

  it('does not render a Google button without a client id', () => {
    open()
    expect(screen.queryByText(/continue with google/i)).not.toBeInTheDocument()
    expect(screen.queryByText('or')).not.toBeInTheDocument()
  })
})

describe('forgot password', () => {
  it('always reports success for a valid email', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(null))
    renderApp(<ForgotPassword />, { loggedIn: false })
    await user.type(screen.getByLabelText('Email'), 'nobody@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText(/If an account exists/)).toBeInTheDocument()
    expect(calls[0].url).toBe('/auth/password/forgot')
    expect(bodyOf(calls[0])).toEqual({ email: 'nobody@example.com', role: 'patient' })
  })

  it('rejects an invalid email', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(null))
    renderApp(<ForgotPassword />, { loggedIn: false })
    await user.type(screen.getByLabelText('Email'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })
})

describe('reset password', () => {
  const open = (route) => renderApp(<ResetPassword />, { route, path: '/reset-password', loggedIn: false })

  it('rejects links without a token', () => {
    open('/reset-password?role=patient')
    expect(screen.getByText('This link is not valid')).toBeInTheDocument()
  })

  it('rejects links for another role', () => {
    open('/reset-password?token=abc&role=doctor')
    expect(screen.getByText('This link is not valid')).toBeInTheDocument()
  })

  it('checks that both passwords match', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(null))
    open('/reset-password?token=abc&role=patient')
    await user.type(screen.getByLabelText('New password'), 'goodpass1')
    await user.type(screen.getByLabelText('Confirm new password'), 'different1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('submits the token and new password, then goes to login', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(null))
    open('/reset-password?token=abc&role=patient')
    await user.type(screen.getByLabelText('New password'), 'goodpass1')
    await user.type(screen.getByLabelText('Confirm new password'), 'goodpass1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => expect(currentLocation(screen)).toBe('/login'))
    expect(bodyOf(calls[0])).toEqual({ token: 'abc', password: 'goodpass1' })
  })

  it('explains an expired token', async () => {
    const user = userEvent.setup()
    mockApi(() => fail(400, 'BAD_REQUEST', 'Token expired'))
    open('/reset-password?token=abc&role=patient')
    await user.type(screen.getByLabelText('New password'), 'goodpass1')
    await user.type(screen.getByLabelText('Confirm new password'), 'goodpass1')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(currentLocation(screen)).toBe('/reset-password?token=abc&role=patient')
  })
})
