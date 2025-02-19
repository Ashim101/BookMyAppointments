import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'react-toastify'
import { describe, expect, it, vi } from 'vitest'
import { makeAppointment, makeSlots } from '../../test/factories'
import { bodyOf, fail, mockApi, ok } from '../../test/http'
import CancelModal from './CancelModal'
import RescheduleModal from './RescheduleModal'
import ReviewModal from './ReviewModal'

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const appointment = makeAppointment({ actions: { canCancel: true, canReschedule: true, canReview: true } })

describe('CancelModal', () => {
  const setup = (props = {}) => {
    const onClose = vi.fn()
    const onCancelled = vi.fn()
    render(<CancelModal appointment={appointment} open onClose={onClose} onCancelled={onCancelled} {...props} />)
    return { onClose, onCancelled }
  }

  it('states the cancellation cutoff in the clinic timezone', () => {
    setup()
    const policy = screen.getByText(/Cancellation policy/).closest('p')
    expect(policy).toHaveTextContent('up to 24 hours before the appointment')
    expect(policy).toHaveTextContent('until 9 Dec 2026, 10:30 AM')
  })

  it('mentions the automatic refund only for paid appointments', () => {
    setup()
    expect(screen.queryByText(/refund will be started/)).not.toBeInTheDocument()
    setup({ appointment: { ...appointment, paymentStatus: 'paid' } })
    expect(screen.getByText(/refund will be started/)).toBeInTheDocument()
  })

  it('requires a reason before calling the API', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(appointment))
    setup()
    await user.click(screen.getByRole('button', { name: 'Cancel appointment', hidden: false }))
    expect(await screen.findByText('Please tell us why')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('sends the reason and reports the updated appointment', async () => {
    const user = userEvent.setup()
    const cancelled = { ...appointment, status: 'cancelled' }
    const calls = mockApi(() => ok(cancelled))
    const { onCancelled } = setup()
    await user.type(screen.getByLabelText('Reason for cancelling'), 'Clash with work')
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Cancel appointment' }).at(-1))

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(cancelled))
    expect(calls[0].method).toBe('patch')
    expect(calls[0].url).toBe('/appointments/a1/cancel')
    expect(bodyOf(calls[0])).toEqual({ reason: 'Clash with work' })
  })

  it('closes with a friendly message when the window has passed', async () => {
    const user = userEvent.setup()
    mockApi(() => fail(422, 'CANCELLATION_WINDOW_PASSED'))
    const { onClose } = setup()
    await user.type(screen.getByLabelText('Reason for cancelling'), 'Too late')
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Cancel appointment' }).at(-1))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/too late to change/))
  })

  it('can be dismissed with Escape or the keep button', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Keep appointment' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('RescheduleModal', () => {
  const slots = makeSlots([['2026-12-14', ['09:00', '11:00']]])

  const setup = (handler, props = {}) => {
    const calls = mockApi(handler)
    const onRescheduled = vi.fn()
    const onClose = vi.fn()
    render(<RescheduleModal appointment={appointment} open onClose={onClose} onRescheduled={onRescheduled} {...props} />)
    return { calls, onRescheduled, onClose }
  }

  it('reuses the slot picker and keeps the confirm button disabled until a slot is chosen', async () => {
    setup(() => ok(slots))
    const confirm = screen.getByRole('button', { name: 'Choose a new time' })
    expect(confirm).toBeDisabled()
    expect(await screen.findByRole('button', { name: '11:00 AM' })).toBeInTheDocument()
    expect(screen.getByText(/reschedule 2 more times/)).toBeInTheDocument()
  })

  it('moves the appointment to the chosen slot', async () => {
    const user = userEvent.setup()
    const moved = { ...appointment, date: '2026-12-14', time: '11:00' }
    const { calls, onRescheduled } = setup((config) => (config.url.endsWith('/slots') ? ok(slots) : ok(moved)))
    await user.click(await screen.findByRole('button', { name: '11:00 AM' }))
    await user.click(screen.getByRole('button', { name: /Move to 14 Dec, 11:00 AM/ }))

    await waitFor(() => expect(onRescheduled).toHaveBeenCalledWith(moved))
    const patch = calls.find((c) => c.method === 'patch')
    expect(patch.url).toBe('/appointments/a1/reschedule')
    expect(bodyOf(patch)).toEqual({ date: '2026-12-14', time: '11:00' })
  })

  it('refreshes the slots and explains when the slot was just taken', async () => {
    const user = userEvent.setup()
    const { calls, onRescheduled } = setup((config) => (config.url.endsWith('/slots') ? ok(slots) : fail(409, 'SLOT_TAKEN')))
    await user.click(await screen.findByRole('button', { name: '09:00 AM'.replace('09', '9') }))
    await user.click(screen.getByRole('button', { name: /Move to/ }))

    expect(await screen.findByText(/Someone else just booked that time/)).toBeInTheDocument()
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/slots'))).toHaveLength(2))
    expect(screen.getByRole('button', { name: 'Choose a new time' })).toBeDisabled()
    expect(onRescheduled).not.toHaveBeenCalled()
  })

  it('tells the patient when no reschedules remain', () => {
    setup(() => ok(slots), { appointment: { ...appointment, rescheduleCount: 2 } })
    expect(screen.getByText(/reschedule no more times/)).toBeInTheDocument()
  })
})

describe('ReviewModal', () => {
  it('validates the rating, then submits rating and comment', async () => {
    const user = userEvent.setup()
    const reviewed = { ...appointment, review: { rating: 5, comment: 'Wonderful', createdAt: '2026-12-11T00:00:00Z' } }
    const calls = mockApi(() => ok(reviewed))
    const onReviewed = vi.fn()
    render(<ReviewModal appointment={appointment} open onClose={() => {}} onReviewed={onReviewed} />)

    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(await screen.findByText('Choose a rating from 1 to 5')).toBeInTheDocument()
    expect(calls).toHaveLength(0)

    await user.click(screen.getByLabelText('5 stars'))
    await user.type(screen.getByLabelText(/Comments/), 'Wonderful')
    await user.click(screen.getByRole('button', { name: 'Submit review' }))

    await waitFor(() => expect(onReviewed).toHaveBeenCalledWith(reviewed))
    expect(calls[0].url).toBe('/appointments/a1/review')
    expect(bodyOf(calls[0])).toEqual({ rating: 5, comment: 'Wonderful' })
  })

  it('closes when the appointment was already reviewed', async () => {
    const user = userEvent.setup()
    mockApi(() => fail(409, 'ALREADY_REVIEWED'))
    const onClose = vi.fn()
    render(<ReviewModal appointment={appointment} open onClose={onClose} onReviewed={() => {}} />)
    await user.click(screen.getByLabelText('3 stars'))
    await user.click(screen.getByRole('button', { name: 'Submit review' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/already reviewed/))
  })
})
