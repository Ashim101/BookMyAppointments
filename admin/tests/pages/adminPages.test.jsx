import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Specialities from '../../src/pages/admin/Specialities'
import Appointments from '../../src/pages/admin/Appointments'
import Patients from '../../src/pages/admin/Patients'
import Reviews from '../../src/pages/admin/Reviews'
import AuditLog from '../../src/pages/admin/AuditLog'
import Settings from '../../src/pages/admin/Settings'
import Dashboard from '../../src/pages/admin/Dashboard'
import { writeSession } from '../../src/api/session'
import { body, fail, mockApi, ok, session } from '../helpers/http'
import { appointment, doctor, paginated, specialities, withActions } from '../helpers/fixtures'
import { renderWithProviders } from '../helpers/render'

describe('Specialities', () => {
  it('previews the slug while typing and creates', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /admin/specialities': ok(specialities), 'POST /admin/specialities': ok(specialities[0]) })
    renderWithProviders(<Specialities />)
    await user.click(await screen.findByRole('button', { name: /Add speciality/ }))
    await user.type(screen.getByLabelText(/Name/), 'Ear, Nose & Throat')
    expect(screen.getByText('Slug: ear-nose-throat')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Description'), 'ENT care')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'post')).toBe(true))
    expect(body(calls.find((c) => c.method === 'post'))).toEqual({ name: 'Ear, Nose & Throat', description: 'ENT care' })
  })

  it('requires a name', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /admin/specialities': ok(specialities) })
    renderWithProviders(<Specialities />)
    await user.click(await screen.findByRole('button', { name: /Add speciality/ }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Enter a name of at least 2 characters')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'post')).toBe(false)
  })

  it('edits an existing speciality', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /admin/specialities': ok(specialities), 'PATCH /admin/specialities/:id': ok(specialities[0]) })
    renderWithProviders(<Specialities />)
    await user.click(await screen.findByRole('button', { name: 'Edit Cardiology' }))
    await user.type(screen.getByLabelText(/Name/), ' Care')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'patch')).toBe(true))
    expect(calls.find((c) => c.method === 'patch').url).toBe('/admin/specialities/s1')
  })

  it('explains the conflict when doctors still use a speciality', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /admin/specialities': ok(specialities), 'DELETE /admin/specialities/:id': fail(409, 'CONFLICT', 'in use') })
    renderWithProviders(<Specialities />)
    await user.click(await screen.findByRole('button', { name: 'Delete Cardiology' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('2 doctors still use this speciality. Reassign them to another speciality first.')
  })

  it('deletes an unused speciality', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /admin/specialities': ok(specialities), 'DELETE /admin/specialities/:id': ok(null) })
    renderWithProviders(<Specialities />)
    await user.click(await screen.findByRole('button', { name: 'Delete Dermatology' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(calls.find((c) => c.method === 'delete').url).toBe('/admin/specialities/s2')
  })
})

describe('Admin appointments', () => {
  const routes = (extra = {}) =>
    mockApi({
      'GET /admin/doctors': ok(paginated([doctor()])),
      'GET /appointments': ok(paginated([withActions({ canCancel: true })])),
      ...extra,
    })
  const lastQuery = (calls) => calls.filter((c) => c.url === '/appointments').at(-1).params

  it('applies filters and exports the CSV with the same filters', async () => {
    const user = userEvent.setup()
    URL.createObjectURL = vi.fn(() => 'blob:csv')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    writeSession(session({ user: { id: 'a', name: 'Ada', email: 'a@x.io', role: 'admin', image: null } }))
    const calls = routes({
      'GET /admin/appointments/export': () => ({ data: new Blob(['id']), headers: { 'content-disposition': 'attachment; filename="appointments.csv"' } }),
    })
    renderWithProviders(<Appointments />)
    await screen.findByText('Pat Ient')

    await user.selectOptions(screen.getByLabelText('Status'), 'booked')
    await user.selectOptions(await screen.findByLabelText('Doctor'), 'd1')
    await user.selectOptions(screen.getByLabelText('Timing'), 'upcoming')
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } })
    await waitFor(() => expect(lastQuery(calls)).toMatchObject({ status: 'booked', doctorId: 'd1', scope: 'upcoming', from: '2026-11-01', page: 1, limit: 10 }))

    await user.click(screen.getByRole('button', { name: /Export CSV/ }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    const exportCall = calls.find((c) => c.url === '/admin/appointments/export')
    expect(exportCall.params).toEqual({ status: 'booked', doctorId: 'd1', scope: 'upcoming', from: '2026-11-01' })
    expect(exportCall.headers.Authorization).toBe('Bearer old')
    click.mockRestore()
  })

  it('shows details and cancels with a reason when the API allows it', async () => {
    const user = userEvent.setup()
    const calls = routes({ 'PATCH /appointments/:id/cancel': ok(withActions({}, { status: 'cancelled', cancellation: { by: 'admin', reason: 'Clinic closed', at: '2026-11-08T00:00:00Z' } })) })
    renderWithProviders(<Appointments />)
    await user.click(await screen.findByText('Pat Ient'))
    const drawer = screen.getByRole('dialog', { name: 'Appointment details' })
    expect(within(drawer).getByText('Persistent cough')).toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Cancel appointment' }))
    await user.type(screen.getByLabelText(/Reason/), 'Clinic closed')
    await user.click(within(screen.getByRole('dialog', { name: 'Cancel appointment' })).getByRole('button', { name: 'Cancel appointment' }))
    expect(await screen.findByText('Cancelled by admin')).toBeInTheDocument()
    expect(body(calls.find((c) => c.method === 'patch'))).toEqual({ reason: 'Clinic closed' })
  })

  it('hides the cancel action when the API does not allow it', async () => {
    const user = userEvent.setup()
    routes({ 'GET /appointments': ok(paginated([withActions({}, { status: 'completed' })])) })
    renderWithProviders(<Appointments />)
    await user.click(await screen.findByText('Pat Ient'))
    expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument()
  })
})

describe('Patients', () => {
  const patient = { id: 'p1', name: 'Pat Ient', email: 'pat@x.io', image: null, phone: '1', gender: 'female', dob: '1990-01-01', blocked: false, appointmentsCount: 3, address: { line1: '', line2: '', city: '' }, createdAt: '2026-01-01' }

  it('filters by blocked state and searches', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /admin/patients': ok(paginated([patient])) })
    renderWithProviders(<Patients />)
    await screen.findByText('Pat Ient')
    await user.selectOptions(screen.getByLabelText('Account status'), 'true')
    await waitFor(() => expect(calls.at(-1).params).toMatchObject({ blocked: 'true' }))
    await user.type(screen.getByLabelText('Search by name or email'), 'pat')
    await waitFor(() => expect(calls.at(-1).params).toMatchObject({ search: 'pat', blocked: 'true' }))
  })

  it('blocks only after confirmation and unblocks blocked patients', async () => {
    const user = userEvent.setup()
    let blocked = false
    const calls = mockApi({
      'GET /admin/patients': () => ok(paginated([{ ...patient, blocked }])),
      'PATCH /admin/patients/:id/block': (config) => {
        blocked = body(config).blocked
        return ok({ ...patient, blocked })
      },
    })
    renderWithProviders(<Patients />)
    await user.click(await screen.findByRole('button', { name: 'Block' }))
    expect(calls.some((c) => c.method === 'patch')).toBe(false)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Block' }))
    expect(await screen.findByRole('button', { name: 'Unblock' })).toBeInTheDocument()
    expect(body(calls.find((c) => c.method === 'patch'))).toEqual({ blocked: true })
    await user.click(screen.getByRole('button', { name: 'Unblock' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Unblock' }))
    expect(await screen.findByRole('button', { name: 'Block' })).toBeInTheDocument()
  })

  it("shows a patient's appointments", async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      'GET /admin/patients': ok(paginated([patient])),
      'GET /appointments': ok(paginated([appointment({ doctor: { ...appointment().doctor, name: 'Dr. Zed' } })])),
    })
    renderWithProviders(<Patients />)
    await user.click(await screen.findByRole('button', { name: 'View appointments of Pat Ient' }))
    expect(await screen.findByText('Dr. Zed')).toBeInTheDocument()
    expect(calls.find((c) => c.url === '/appointments').params).toMatchObject({ patientId: 'p1' })
  })
})

describe('Reviews', () => {
  const review = { id: 'r1', rating: 2, comment: 'Long wait', createdAt: '2026-10-01T00:00:00Z', patient: { id: 'p1', name: 'Pat Ient', image: null }, doctor: { id: 'd1', name: 'Dr. Asha Rao' } }

  it('filters and deletes after confirmation', async () => {
    const user = userEvent.setup()
    let reviews = [review]
    const calls = mockApi({
      'GET /admin/doctors': ok(paginated([doctor()])),
      'GET /admin/reviews': () => ok(paginated(reviews)),
      'DELETE /admin/reviews/:id': () => {
        reviews = []
        return ok(null)
      },
    })
    renderWithProviders(<Reviews />)
    expect(await screen.findByText('Long wait')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Maximum rating'), '2')
    await user.selectOptions(await screen.findByLabelText('Doctor'), 'd1')
    await waitFor(() => expect(calls.filter((c) => c.url === '/admin/reviews').at(-1).params).toMatchObject({ maxRating: '2', doctorId: 'd1' }))

    await user.click(screen.getByRole('button', { name: 'Delete review by Pat Ient' }))
    expect(calls.some((c) => c.method === 'delete')).toBe(false)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(await screen.findByText('No reviews match these filters.')).toBeInTheDocument()
  })
})

describe('Audit log', () => {
  const entry = { id: 'l1', actor: { role: 'admin', id: 'a', name: 'Ada' }, action: 'doctor.create', target: { type: 'doctor', id: 'd1' }, meta: { email: 'x@y.io' }, ip: '10.0.0.1', createdAt: '2026-11-01T10:00:00Z' }

  it('expands meta JSON and filters by action and role', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /admin/audit-logs': ok(paginated([entry])) })
    renderWithProviders(<AuditLog />)
    expect(await screen.findByText('Doctor create')).toBeInTheDocument()
    expect(screen.queryByText(/"email"/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show details for doctor.create' }))
    expect(screen.getByText(/"email": "x@y.io"/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide details for doctor.create' }))
    expect(screen.queryByText(/"email"/)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Actor role'), 'doctor')
    await user.type(screen.getByLabelText('Action'), 'appointment')
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-30' } })
    await waitFor(() => expect(calls.at(-1).params).toMatchObject({ actorRole: 'doctor', action: 'appointment', to: '2026-11-30', limit: 20 }))
  })
})

describe('Settings', () => {
  const settings = { cancellationCutoffHours: 24, bookingWindowDays: 30, defaultSlotMinutes: 30, currency: 'INR', timezone: 'Asia/Kolkata' }

  it('loads values, keeps timezone read-only and saves valid changes', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /admin/settings': ok(settings), 'PUT /admin/settings': (config) => ok({ ...settings, ...body(config) }) })
    renderWithProviders(<Settings />)
    expect(await screen.findByLabelText('Timezone')).toHaveValue('Asia/Kolkata')
    expect(screen.getByLabelText('Timezone')).toBeDisabled()
    await user.clear(screen.getByLabelText(/Cancellation cutoff/))
    await user.type(screen.getByLabelText(/Cancellation cutoff/), '12')
    await user.clear(screen.getByLabelText('Currency'))
    await user.type(screen.getByLabelText('Currency'), 'usd')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'put')).toBe(true))
    expect(body(calls.find((c) => c.method === 'put'))).toEqual({ cancellationCutoffHours: 12, bookingWindowDays: 30, defaultSlotMinutes: 30, currency: 'USD' })
  })

  it('blocks invalid values', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /admin/settings': ok(settings) })
    renderWithProviders(<Settings />)
    await user.clear(await screen.findByLabelText(/Booking window/))
    await user.type(screen.getByLabelText(/Booking window/), '0')
    await user.clear(screen.getByLabelText('Currency'))
    await user.type(screen.getByLabelText('Currency'), 'R')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(screen.getByText('Enter whole days from 1 to 365')).toBeInTheDocument()
    expect(screen.getByText('Use a three-letter ISO code such as INR')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'put')).toBe(false)
  })
})

describe('Admin dashboard', () => {
  it('renders summary cards, tables and requests the timeseries for the chosen interval', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      'GET /admin/analytics/summary': ok({ doctors: 12, activeDoctors: 10, patients: 340, appointments: { total: 900, booked: 40, completed: 800, cancelled: 50, noShow: 10 }, revenue: { total: 450000, last30Days: 30000 }, cancellationRate: 0.056, averageRating: 4.6 }),
      'GET /admin/analytics/timeseries': ok([{ period: '2026-10-01', appointments: 5, completed: 4, cancelled: 1, revenue: 2500 }, { period: '2026-10-02', appointments: 8, completed: 8, cancelled: 0, revenue: 4000 }]),
      'GET /admin/analytics/specialities': ok([{ speciality: 'cardiology', specialityName: 'Cardiology', appointments: 30, revenue: 9000 }]),
      'GET /admin/analytics/top-doctors': ok([{ doctor: { id: 'd1', name: 'Dr. Asha Rao', image: null, speciality: 'Cardiology' }, appointments: 50, revenue: 20000, rating: 4.8 }]),
      'GET /appointments': ok(paginated([appointment()])),
    })
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('5.6%')).toBeInTheDocument()
    expect(screen.getByText('12 registered')).toBeInTheDocument()
    expect(screen.getByText('4.6')).toBeInTheDocument()
    expect(await screen.findAllByText('Dr. Asha Rao')).toHaveLength(2)
    expect(await screen.findByRole('img', { name: 'Cardiology: 30 (100%)' })).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Appointments and revenue over time' })).toBeInTheDocument()
    expect(calls.find((c) => c.url === '/admin/analytics/timeseries').params).toMatchObject({ interval: 'day' })

    await user.click(screen.getByRole('tab', { name: 'Monthly' }))
    await waitFor(() => expect(calls.filter((c) => c.url === '/admin/analytics/timeseries').at(-1).params.interval).toBe('month'))
  })

  it('shows an error state when the summary fails', async () => {
    mockApi({ 'GET /admin/analytics/summary': fail(500, 'INTERNAL', 'Summary down'), 'GET /admin/analytics/timeseries': ok([]), 'GET /admin/analytics/specialities': ok([]), 'GET /admin/analytics/top-doctors': ok([]), 'GET /appointments': ok(paginated([])) })
    renderWithProviders(<Dashboard />)
    expect(await screen.findByText('Summary down')).toBeInTheDocument()
    expect(await screen.findByText('No completed visits yet.')).toBeInTheDocument()
  })
})
