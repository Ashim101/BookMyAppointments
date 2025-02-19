import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { makeAppointment } from '../../test/factories'
import AppointmentCard from './AppointmentCard'

const handlers = () => ({ onPay: vi.fn(), onCancel: vi.fn(), onReschedule: vi.fn(), onReview: vi.fn() })

function show(appointment, extra = {}) {
  const h = handlers()
  render(
    <MemoryRouter>
      <AppointmentCard appointment={appointment} {...h} {...extra} />
    </MemoryRouter>,
  )
  return h
}

const button = (name) => screen.queryByRole('button', { name })

describe('AppointmentCard', () => {
  it('shows doctor, formatted date and time, fee and badges', () => {
    show(makeAppointment({ status: 'booked', paymentStatus: 'unpaid' }))
    expect(screen.getByRole('link', { name: 'Dr. Priya Nair' })).toHaveAttribute('href', '/doctors/d1')
    expect(screen.getByText('Thu, 10 Dec 2026')).toBeInTheDocument()
    expect(screen.getByText('10:30 AM')).toBeInTheDocument()
    expect(screen.getByText('₹800')).toBeInTheDocument()
    expect(screen.getByText('Booked')).toBeInTheDocument()
    expect(screen.getByText('Payment due')).toBeInTheDocument()
  })

  it('renders no action buttons when every flag is false', () => {
    show(makeAppointment({ status: 'cancelled', cancellation: { by: 'doctor', reason: 'Sick leave', at: '2026-12-01T00:00:00Z' } }))
    for (const name of ['Pay now', 'Reschedule', 'Cancel', 'Leave a review']) expect(button(name)).not.toBeInTheDocument()
    expect(screen.getByText(/Cancelled by doctor: Sick leave/)).toBeInTheDocument()
  })

  it.each([
    ['canPay', 'Pay now'],
    ['canReschedule', 'Reschedule'],
    ['canCancel', 'Cancel'],
    ['canReview', 'Leave a review'],
  ])('shows only the %s action when that flag is set', (flag, label) => {
    show(makeAppointment({ actions: { [flag]: true } }))
    const all = ['Pay now', 'Reschedule', 'Cancel', 'Leave a review']
    for (const name of all) {
      if (name === label) expect(button(name)).toBeInTheDocument()
      else expect(button(name)).not.toBeInTheDocument()
    }
  })

  it('does not show actions from status alone', () => {
    show(makeAppointment({ status: 'booked', paymentStatus: 'unpaid', actions: {} }))
    expect(button('Pay now')).not.toBeInTheDocument()
    expect(button('Cancel')).not.toBeInTheDocument()
  })

  it('calls the matching handler with the appointment', async () => {
    const user = userEvent.setup()
    const appointment = makeAppointment({ actions: { canPay: true, canCancel: true, canReschedule: true, canReview: true } })
    const h = show(appointment)
    await user.click(button('Pay now'))
    await user.click(button('Cancel'))
    await user.click(button('Reschedule'))
    await user.click(button('Leave a review'))
    expect(h.onPay).toHaveBeenCalledWith(appointment)
    expect(h.onCancel).toHaveBeenCalledWith(appointment)
    expect(h.onReschedule).toHaveBeenCalledWith(appointment)
    expect(h.onReview).toHaveBeenCalledWith(appointment)
  })

  it('disables the pay button and shows progress while busy', () => {
    show(makeAppointment({ actions: { canPay: true } }), { busy: true })
    expect(button(/Pay now/)).toBeDisabled()
  })

  it('links to the consultation notes once completed', () => {
    show(
      makeAppointment({
        status: 'completed',
        paymentStatus: 'paid',
        consultation: { notes: 'Rest', prescription: [], completedAt: '2026-12-10T06:00:00Z' },
      }),
    )
    expect(screen.getByRole('link', { name: /View notes and prescription/ })).toHaveAttribute('href', '/my-appointments/a1')
    expect(button('Add to calendar')).not.toBeInTheDocument()
  })

  it('shows a submitted review', () => {
    show(makeAppointment({ status: 'completed', review: { rating: 4, comment: 'Very kind', createdAt: '2026-12-11T00:00:00Z' } }))
    expect(screen.getByRole('img', { name: '4 out of 5 stars' })).toBeInTheDocument()
    expect(screen.getByText('Very kind')).toBeInTheDocument()
  })
})
