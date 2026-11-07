import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'react-toastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bodyOf, fail, mockApi, ok } from '../test/http'
import { makeAppointment, makeDoctor, makeSlots, page } from '../test/factories'
import { currentLocation, renderApp } from '../test/render'
import DoctorProfile from './DoctorProfile'

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const slots = makeSlots([['2026-12-10', ['09:00', '09:30', '10:00']]])
let bookingResponses

function routes(doctor = makeDoctor()) {
  return mockApi((config) => {
    if (config.url === '/doctors/d1') return ok(doctor)
    if (config.url === '/doctors/d1/slots') return ok(slots)
    if (config.url === '/doctors/d1/reviews') return ok(page([]))
    if (config.url === '/appointments') return bookingResponses.shift()
    return fail(404, 'NOT_FOUND')
  })
}

const open = (options) => renderApp(<DoctorProfile />, { route: '/doctors/d1', path: '/doctors/:id', ...options })

beforeEach(() => {
  bookingResponses = []
})

describe('booking from the doctor profile', () => {
  it('shows the doctor, fee and an empty reviews state', async () => {
    routes()
    open()
    expect(await screen.findByRole('heading', { name: 'Dr. Priya Nair' })).toBeInTheDocument()
    expect(screen.getByText('₹800')).toBeInTheDocument()
    expect(await screen.findByText('No reviews yet')).toBeInTheDocument()
  })

  it('books the selected slot with the optional reason and goes to my appointments', async () => {
    const user = userEvent.setup()
    const calls = routes()
    bookingResponses.push(ok(makeAppointment(), 201))
    open()

    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))
    await user.type(screen.getByLabelText(/Reason for visit/), 'Annual check')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    await waitFor(() => expect(currentLocation(screen)).toBe('/my-appointments'))
    const post = calls.find((c) => c.method === 'post')
    expect(bodyOf(post)).toEqual({ doctorId: 'd1', date: '2026-12-10', time: '09:00', reason: 'Annual check' })
    expect(toast.success).toHaveBeenCalled()
  })

  it('omits the reason when it is left blank', async () => {
    const user = userEvent.setup()
    const calls = routes()
    bookingResponses.push(ok(makeAppointment(), 201))
    open()
    await user.click(await screen.findByRole('button', { name: '9:30 AM' }))
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'post')).toBe(true))
    expect(bodyOf(calls.find((c) => c.method === 'post'))).toEqual({ doctorId: 'd1', date: '2026-12-10', time: '09:30' })
  })

  it('explains SLOT_TAKEN, clears the selection and refreshes the slots', async () => {
    const user = userEvent.setup()
    const calls = routes()
    bookingResponses.push(fail(409, 'SLOT_TAKEN'))
    open()

    await user.click(await screen.findByRole('button', { name: '10:00 AM' }))
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))

    expect(await screen.findByText(/Someone else just booked that time/)).toBeInTheDocument()
    expect(screen.getByText(/refreshed the available times/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument()
    await waitFor(() => expect(calls.filter((c) => c.url === '/doctors/d1/slots')).toHaveLength(2))
    expect(currentLocation(screen)).toBe('/doctors/d1')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('handles SLOT_UNAVAILABLE the same way', async () => {
    const user = userEvent.setup()
    const calls = routes()
    bookingResponses.push(fail(422, 'SLOT_UNAVAILABLE'))
    open()
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    expect(await screen.findByText(/no longer available/)).toBeInTheDocument()
    await waitFor(() => expect(calls.filter((c) => c.url === '/doctors/d1/slots')).toHaveLength(2))
  })

  it('toasts other booking errors without leaving the page', async () => {
    const user = userEvent.setup()
    routes()
    bookingResponses.push(fail(403, 'ACCOUNT_BLOCKED'))
    open()
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/blocked/)))
    expect(currentLocation(screen)).toBe('/doctors/d1')
  })

  it('sends logged-out visitors to login and remembers the chosen slot', async () => {
    const user = userEvent.setup()
    const calls = routes()
    open({ loggedIn: false })
    await user.click(await screen.findByRole('button', { name: '9:00 AM' }))
    await user.click(screen.getByRole('button', { name: 'Sign in to book' }))

    expect(currentLocation(screen)).toBe('/login')
    const state = JSON.parse(screen.getByTestId('location').dataset.state)
    expect(state.from).toBe('/doctors/d1?date=2026-12-10&time=09:00')
    expect(calls.some((c) => c.method === 'post')).toBe(false)
  })

  it('restores a slot preselected through the query string', async () => {
    routes()
    open({ route: '/doctors/d1?date=2026-12-10&time=09:30' })
    expect(await screen.findByRole('button', { name: 'Confirm booking' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '9:30 AM' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not offer booking when the doctor is unavailable', async () => {
    routes(makeDoctor({ available: false }))
    open()
    expect(await screen.findByText(/not accepting new bookings/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '9:00 AM' })).not.toBeInTheDocument()
  })

  it('shows a not found state for unknown doctors', async () => {
    mockApi(() => fail(404, 'NOT_FOUND'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not find/)
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})
