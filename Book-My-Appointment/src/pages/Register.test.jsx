import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bodyOf, fail, mockApi, ok } from '../test/http'
import { session } from '../test/factories'
import { currentLocation, renderApp } from '../test/render'
import Register from './Register'

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const fillDetails = async (user) => {
  await user.type(screen.getByLabelText('Full name'), 'Asha Kumar')
  await user.type(screen.getByLabelText('Email'), 'asha@example.com')
  await user.type(screen.getByLabelText('Password'), 'goodpass1')
  await user.click(screen.getByRole('button', { name: 'Send verification code' }))
}

const open = () => renderApp(<Register />, { route: '/register', path: '/register', loggedIn: false })

afterEach(() => vi.useRealTimers())

describe('registration with OTP', () => {
  it('validates the details before requesting a code', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok({}))
    open()
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Send verification code' }))
    expect(await screen.findByText('Enter your full name')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('requests a code, accepts a pasted OTP and registers', async () => {
    const user = userEvent.setup()
    const calls = mockApi((config) => (config.url === '/auth/otp/request' ? ok({ expiresInSeconds: 600, resendAfterSeconds: 60 }) : ok(session)))
    const { store } = open()
    await fillDetails(user)

    expect(await screen.findByText('Verify your email')).toBeInTheDocument()
    expect(bodyOf(calls[0])).toEqual({ email: 'asha@example.com' })
    expect(screen.getByRole('button', { name: 'Resend code in 60s' })).toBeDisabled()

    await user.click(screen.getAllByLabelText(/Digit \d of 6/)[0])
    await user.paste('123456')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(store.getState().auth.tokens).toEqual(session))
    expect(calls[1].url).toBe('/auth/register')
    expect(bodyOf(calls[1])).toEqual({ name: 'Asha Kumar', email: 'asha@example.com', password: 'goodpass1', otp: '123456' })
  })

  it('requires all six digits', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok({ expiresInSeconds: 600, resendAfterSeconds: 60 }))
    open()
    await fillDetails(user)
    await screen.findByText('Verify your email')
    await user.keyboard('12')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Enter the 6-digit code')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
  })

  it('clears the code when it is wrong', async () => {
    const user = userEvent.setup()
    mockApi((config) => (config.url === '/auth/otp/request' ? ok({ expiresInSeconds: 600, resendAfterSeconds: 60 }) : fail(422, 'OTP_INVALID')))
    open()
    await fillDetails(user)
    await screen.findByText('Verify your email')
    await user.click(screen.getAllByLabelText(/Digit \d of 6/)[0])
    await user.paste('999999')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('That verification code is not correct.')).toBeInTheDocument()
    expect(screen.getAllByLabelText(/Digit \d of 6/).map((b) => b.value).join('')).toBe('')
  })

  it('shows EMAIL_TAKEN on the email field', async () => {
    const user = userEvent.setup()
    mockApi(() => fail(409, 'EMAIL_TAKEN'))
    open()
    await fillDetails(user)
    expect(await screen.findByText(/already exists/, { selector: 'p[role="alert"]' })).toBeInTheDocument()
    expect(screen.getByText('Create your account')).toBeInTheDocument()
  })

  it('counts down using the server supplied delay and then allows resending', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const calls = mockApi(() => ok({ expiresInSeconds: 600, resendAfterSeconds: 3 }))
    open()
    await fillDetails(user)
    expect(await screen.findByRole('button', { name: 'Resend code in 3s' })).toBeDisabled()

    for (let second = 0; second < 3; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
    }
    const resend = screen.getByRole('button', { name: 'Resend code' })
    expect(resend).toBeEnabled()
    await user.click(resend)
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Resend code in 3s' })).toBeDisabled()
  })

  it('redirects signed-in users away', () => {
    renderApp(<Register />, { route: '/register', path: '/register' })
    expect(currentLocation(screen)).toBe('/')
  })
})
