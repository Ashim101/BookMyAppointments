import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'react-toastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeAppointment, page } from '../test/factories'
import { bodyOf, fail, mockApi, ok } from '../test/http'
import { renderApp } from '../test/render'
import MyAppointments from './MyAppointments'

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const unpaid = makeAppointment({ actions: { canPay: true, canCancel: true, canReschedule: true } })
const paid = makeAppointment({ id: 'a2', paymentStatus: 'paid', actions: { canCancel: true } })
let listing

function api(extra = () => fail(404, 'NOT_FOUND')) {
  return mockApi((config) => {
    if (config.url === '/appointments' && config.method === 'get') return ok(listing(config.params))
    return extra(config)
  })
}

const open = (route = '/my-appointments') => renderApp(<MyAppointments />, { route })

afterEach(() => {
  delete window.Razorpay
})

describe('my appointments', () => {
  it('requests the scope for each tab and shows an empty state', async () => {
    const user = userEvent.setup()
    listing = (params) => page(params.scope === 'upcoming' ? [unpaid] : [])
    const calls = api()
    open()

    expect(await screen.findByText('Dr. Priya Nair')).toBeInTheDocument()
    expect(calls[0].params).toEqual({ scope: 'upcoming', page: 1, limit: 6 })

    await user.click(screen.getByRole('tab', { name: 'Past' }))
    expect(await screen.findByText(/Completed and missed visits/)).toBeInTheDocument()
    expect(calls.at(-1).params.scope).toBe('past')

    await user.click(screen.getByRole('tab', { name: 'Cancelled' }))
    await screen.findByText(/not cancelled any/)
    expect(calls.at(-1).params).toEqual({ status: 'cancelled', page: 1, limit: 6 })
  })

  it('paginates', async () => {
    const user = userEvent.setup()
    listing = (params) => page([unpaid], { page: params.page, total: 12, totalPages: 2 })
    const calls = api()
    open()
    await screen.findByText('Dr. Priya Nair')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(calls.at(-1).params.page).toBe(2))
  })

  it('shows a retryable error when the list cannot load', async () => {
    listing = () => {
      throw new Error('unused')
    }
    mockApi(() => fail(500, 'INTERNAL'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent(/went wrong/)
  })

  it('only shows the actions each appointment allows', async () => {
    listing = () => page([unpaid, paid])
    api()
    open()
    const cards = await screen.findAllByRole('article')
    expect(within(cards[0]).getByRole('button', { name: /Pay now/ })).toBeInTheDocument()
    expect(within(cards[1]).queryByRole('button', { name: /Pay now/ })).not.toBeInTheDocument()
    expect(within(cards[1]).queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument()
  })

  it('cancels an appointment through the reason modal and reloads the list', async () => {
    const user = userEvent.setup()
    let cancelled = false
    listing = () => page(cancelled ? [] : [unpaid])
    const calls = api((config) => {
      if (config.url === '/appointments/a1/cancel') {
        cancelled = true
        return ok({ ...unpaid, status: 'cancelled' })
      }
      return fail(404, 'NOT_FOUND')
    })
    open()
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancel appointment' })
    await user.type(within(dialog).getByLabelText('Reason for cancelling'), 'Travelling')
    await user.click(within(dialog).getAllByRole('button', { name: 'Cancel appointment' }).at(-1))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bodyOf(calls.find((c) => c.url.endsWith('/cancel')))).toEqual({ reason: 'Travelling' })
    expect(await screen.findByText(/no upcoming appointments/)).toBeInTheDocument()
  })
})

describe('payments', () => {
  const order = { mode: 'mock', orderId: 'order_1', amount: 800, currency: 'INR', keyId: null }

  it('confirms a test payment in mock mode, then verifies with mock credentials', async () => {
    const user = userEvent.setup()
    let settled = false
    listing = () => page([settled ? { ...unpaid, paymentStatus: 'paid', actions: {} } : unpaid])
    const calls = api((config) => {
      if (config.url === '/payments/order') return ok(order)
      if (config.url === '/payments/verify') {
        settled = true
        return ok({ ...unpaid, paymentStatus: 'paid' })
      }
      return fail(404, 'NOT_FOUND')
    })
    open()

    await user.click(await screen.findByRole('button', { name: /Pay now/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Test payment' })
    expect(within(dialog).getByText(/test payment/i, { selector: 'strong' })).toBeInTheDocument()
    expect(within(dialog).getByText(/no real/)).toBeInTheDocument()
    expect(calls.some((c) => c.url === '/payments/verify')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Pay ₹800 (test)' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const verify = calls.find((c) => c.url === '/payments/verify')
    expect(bodyOf(verify)).toEqual({ appointmentId: 'a1', orderId: 'order_1', paymentId: expect.stringMatching(/^mock_\d+$/), signature: 'mock' })
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Payment received/))
    expect(await screen.findByText('Paid')).toBeInTheDocument()
  })

  it('does not verify when the test payment dialog is dismissed', async () => {
    const user = userEvent.setup()
    listing = () => page([unpaid])
    const calls = api((config) => (config.url === '/payments/order' ? ok(order) : fail(404, 'NOT_FOUND')))
    open()
    await user.click(await screen.findByRole('button', { name: /Pay now/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Test payment' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.some((c) => c.url === '/payments/verify')).toBe(false)
  })

  it('keeps the dialog open and toasts when verification fails', async () => {
    const user = userEvent.setup()
    listing = () => page([unpaid])
    api((config) => {
      if (config.url === '/payments/order') return ok(order)
      return fail(422, 'PAYMENT_INVALID')
    })
    open()
    await user.click(await screen.findByRole('button', { name: /Pay now/ }))
    await user.click(await screen.findByRole('button', { name: 'Pay ₹800 (test)' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/verify your payment/)))
    expect(screen.getByRole('dialog', { name: 'Test payment' })).toBeInTheDocument()
  })

  it('opens Razorpay checkout in razorpay mode and verifies the handler response', async () => {
    const user = userEvent.setup()
    listing = () => page([unpaid])
    const calls = api((config) => {
      if (config.url === '/payments/order') return ok({ mode: 'razorpay', orderId: 'order_9', amount: 800, currency: 'INR', keyId: 'rzp_test_x' })
      if (config.url === '/payments/verify') return ok({ ...unpaid, paymentStatus: 'paid' })
      return fail(404, 'NOT_FOUND')
    })
    const open_ = vi.fn()
    window.Razorpay = vi.fn(function Razorpay(options) {
      this.options = options
      this.on = vi.fn()
      this.open = () => {
        open_()
        options.handler({ razorpay_payment_id: 'pay_1', razorpay_signature: 'sig_1', razorpay_order_id: 'order_9' })
      }
    })
    open()
    await user.click(await screen.findByRole('button', { name: /Pay now/ }))

    await waitFor(() => expect(open_).toHaveBeenCalled())
    expect(window.Razorpay.mock.calls[0][0]).toMatchObject({ key: 'rzp_test_x', order_id: 'order_9', amount: 80000, currency: 'INR' })
    await waitFor(() => expect(calls.some((c) => c.url === '/payments/verify')).toBe(true))
    expect(bodyOf(calls.find((c) => c.url === '/payments/verify'))).toEqual({
      appointmentId: 'a1',
      orderId: 'order_9',
      paymentId: 'pay_1',
      signature: 'sig_1',
    })
  })

  it('toasts when the order cannot be created', async () => {
    const user = userEvent.setup()
    listing = () => page([unpaid])
    api(() => fail(422, 'INVALID_STATE'))
    open()
    await user.click(await screen.findByRole('button', { name: /Pay now/ }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/can no longer be changed/)))
  })
})
