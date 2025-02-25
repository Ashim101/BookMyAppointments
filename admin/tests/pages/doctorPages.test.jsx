import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import Dashboard from '../../src/pages/doctor/Dashboard'
import Appointments from '../../src/pages/doctor/Appointments'
import Profile from '../../src/pages/doctor/Profile'
import Schedule from '../../src/pages/doctor/Schedule'
import { DoctorLayout } from '../../src/layouts/RoleLayouts'
import { readSession, writeSession } from '../../src/api/session'
import { body, fail, mockApi, ok, session } from '../helpers/http'
import { doctor, paginated, withActions } from '../helpers/fixtures'
import { renderWithProviders } from '../helpers/render'

const dashboard = {
  earnings: { total: 12000, thisMonth: 3000 },
  patients: 40,
  appointments: { today: 2, upcoming: 6, completed: 30, cancelled: 3, noShow: 1 },
  rating: { average: 4.7, count: 12 },
  next: [withActions({}, { id: 'n1', patient: { ...withActions().patient, name: 'Nina Next' } })],
  earningsSeries: [{ period: '2026-10', amount: 2000 }, { period: '2026-11', amount: 3000 }],
}

describe('Doctor dashboard', () => {
  it('shows stats, the earnings chart, a time-ordered queue and the next appointments', async () => {
    const calls = mockApi({
      'GET /doctor/dashboard': ok(dashboard),
      'GET /appointments': ok(paginated([
        withActions({}, { id: 'late', time: '15:00', patient: { ...withActions().patient, name: 'Late Larry' } }),
        withActions({ canComplete: true }, { id: 'early', time: '09:00', patient: { ...withActions().patient, name: 'Early Edna' } }),
        withActions({}, { id: 'x', time: '11:00', status: 'cancelled', patient: { ...withActions().patient, name: 'Cancelled Cy' } }),
      ])),
    })
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('4.7')).toBeInTheDocument()
    expect(screen.getByText('3 cancelled, 1 no-shows')).toBeInTheDocument()
    expect(screen.getByText('Nina Next')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Oct 26: Earnings .*2,000/ })).toBeInTheDocument()

    const queue = (await screen.findByText('Early Edna')).closest('ul')
    const names = within(queue).getAllByRole('button').filter((b) => /Edna|Larry/.test(b.textContent)).map((b) => b.textContent)
    expect(names).toEqual(['Early Edna', 'Late Larry'])
    expect(screen.queryByText('Cancelled Cy')).not.toBeInTheDocument()
    expect(within(queue).getAllByRole('button', { name: 'Complete' })).toHaveLength(1)
    expect(calls.find((c) => c.url === '/appointments').params.from).toBe(calls.find((c) => c.url === '/appointments').params.to)
  })

  it('opens patient history from the queue', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /doctor/dashboard': ok(dashboard),
      'GET /appointments': ok(paginated([withActions({}, { patient: { ...withActions().patient, name: 'Early Edna', id: 'p7' } })])),
      'GET /doctor/patients/:id/appointments': ok([
        withActions({}, { status: 'completed', consultation: { notes: 'Rest advised', prescription: [{ medicine: 'Ibuprofen', dosage: '200 mg', frequency: 'Daily', durationDays: 3, instructions: '' }], completedAt: '2026-10-01T00:00:00Z' } }),
      ]),
    })
    renderWithProviders(<Dashboard />)
    await user.click(await screen.findByRole('button', { name: 'Early Edna' }))
    const drawer = screen.getByRole('dialog', { name: 'Patient history' })
    expect(await within(drawer).findByText('Rest advised')).toBeInTheDocument()
    expect(within(drawer).getByText(/Ibuprofen 200 mg, Daily, 3 days/)).toBeInTheDocument()
  })

  it('shows an error with retry', async () => {
    mockApi({ 'GET /doctor/dashboard': fail(500, 'INTERNAL', 'Down'), 'GET /appointments': ok(paginated([])) })
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Down')).toBeInTheDocument()
    expect(await screen.findByText('No appointments today.')).toBeInTheDocument()
  })
})

describe('Doctor appointments list', () => {
  it('filters server-side and drives actions only from flags', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      'GET /appointments': ok(paginated([
        withActions({ canComplete: true, canCancel: true }, { id: 'a1' }),
        withActions({}, { id: 'a2', status: 'completed', patient: { ...withActions().patient, name: 'Done Dan' } }),
      ])),
    })
    renderWithProviders(<Appointments />)
    await screen.findByText('Pat Ient')
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByRole('button', { name: 'Complete' })).toBeInTheDocument()
    expect(within(rows[0]).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(rows[1]).queryByRole('button', { name: /Complete|Cancel|No-show/ })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Status'), 'completed')
    await user.selectOptions(screen.getByLabelText('Timing'), 'past')
    await waitFor(() => expect(calls.at(-1).params).toMatchObject({ status: 'completed', scope: 'past', limit: 10 }))
  })

  it('refreshes the list after an action', async () => {
    const user = userEvent.setup()
    let status = 'booked'
    const calls = mockApi({
      'GET /appointments': () => ok(paginated([withActions(status === 'booked' ? { canMarkNoShow: true } : {}, { status })])),
      'PATCH /appointments/:id/no-show': () => {
        status = 'no_show'
        return ok(withActions({}, { status }))
      },
    })
    renderWithProviders(<Appointments />)
    await user.click(await screen.findByRole('button', { name: 'No-show' }))
    await user.click(screen.getByRole('button', { name: 'Mark no-show' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'No-show' })).not.toBeInTheDocument())
    expect(screen.getByText('No-show', { selector: 'span' })).toBeInTheDocument()
    expect(calls.filter((c) => c.url === '/appointments')).toHaveLength(2)
  })

  it('does not open the detail drawer when an action button is used', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /appointments': ok(paginated([withActions({ canCancel: true })])) })
    renderWithProviders(<Appointments />)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Appointment details' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Cancel appointment' })).toBeInTheDocument()
  })
})

describe('Doctor profile', () => {
  it('saves editable fields only', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /doctor/profile': ok(doctor()), 'PATCH /doctor/profile': ok(doctor({ fees: 900 })) })
    renderWithProviders(<Profile />)
    await user.clear(await screen.findByLabelText('Consultation fees'))
    await user.type(screen.getByLabelText('Consultation fees'), '900')
    await user.click(screen.getByRole('switch', { name: 'Accepting bookings' }))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'patch')).toBe(true))
    expect(body(calls.find((c) => c.method === 'patch'))).toEqual({
      about: 'Cardiologist', fees: 900, available: false, address: { line1: '1 Road', line2: '', city: 'Pune' },
    })
  })

  it('validates before saving', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /doctor/profile': ok(doctor()) })
    renderWithProviders(<Profile />)
    await user.clear(await screen.findByLabelText('About'))
    await user.clear(screen.getByLabelText('City'))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(screen.getByText('Add a short description')).toBeInTheDocument()
    expect(screen.getByText('City is required')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'patch')).toBe(false)
  })
})

describe('Doctor schedule page', () => {
  it('loads, edits and saves the schedule', async () => {
    const user = userEvent.setup()
    const saved = { slotMinutes: 15, weekly: [{ day: 1, start: '09:00', end: '12:00', breaks: [] }] }
    const calls = mockApi({ 'GET /doctor/schedule': ok(doctor().schedule), 'PUT /doctor/schedule': ok(saved) })
    renderWithProviders(<Schedule />)
    await user.selectOptions(await screen.findByLabelText('Slot length'), '15')
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'put')).toBe(true))
    expect(body(calls.find((c) => c.method === 'put'))).toEqual(saved)
  })

  it('surfaces server rejection without losing edits', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /doctor/schedule': ok(doctor().schedule), 'PUT /doctor/schedule': fail(400, 'VALIDATION_ERROR', 'Bad schedule') })
    renderWithProviders(<Schedule />)
    fireEvent.change(await screen.findByLabelText('Monday end'), { target: { value: '15:00' } })
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save schedule' })).not.toBeDisabled())
    expect(screen.getByLabelText('Monday end')).toHaveValue('15:00')
  })
})

describe('Doctor layout', () => {
  it('shows doctor navigation and signs out through the API', async () => {
    const user = userEvent.setup()
    writeSession(session())
    const calls = mockApi({ 'GET /notifications': ok({ ...paginated([]), unreadCount: 0 }), 'POST /auth/logout': ok(null) })
    const { store } = renderWithProviders(
      <Routes>
        <Route element={<DoctorLayout />}>
          <Route index element={<p>content</p>} />
        </Route>
      </Routes>,
      { role: 'doctor' },
    )
    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('href', '/doctor/calendar')
    expect(screen.queryByRole('link', { name: 'Specialities' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(store.getState().auth.user).toBeNull())
    expect(body(calls.find((c) => c.url === '/auth/logout'))).toEqual({ refreshToken: 'refresh-1' })
    expect(readSession()).toBeNull()
  })
})
