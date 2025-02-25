import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Calendar from '../../src/pages/doctor/Calendar'
import Doctors from '../../src/pages/admin/Doctors'
import { startOfWeek, todayISO } from '../../src/lib/date'
import { mockApi, ok } from '../helpers/http'
import { doctor, paginated, specialities, withActions } from '../helpers/fixtures'
import { renderWithProviders } from '../helpers/render'

describe('Calendar agenda view', () => {
  const monday = startOfWeek(todayISO())

  it('lists the week day by day in time order and opens details', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /doctor/schedule': ok({ slotMinutes: 30, weekly: [{ day: 1, start: '09:00', end: '17:00', breaks: [] }] }),
      'GET /doctor/leaves': ok([{ id: 'l1', date: monday, reason: 'Training' }]),
      'GET /appointments': ok(paginated([
        withActions({}, { id: 'late', date: monday, time: '14:00', patient: { ...withActions().patient, name: 'Late Larry' } }),
        withActions({ canCancel: true }, { id: 'early', date: monday, time: '09:30', patient: { ...withActions().patient, name: 'Early Edna' } }),
      ])),
    })
    renderWithProviders(<Calendar />, { role: 'doctor' })
    await screen.findByRole('button', { name: /Early Edna/ })
    await user.click(screen.getByRole('tab', { name: 'Agenda' }))

    const sections = screen.getAllByRole('region')
    expect(sections).toHaveLength(7)
    const first = sections[0]
    expect(within(first).getByText('On leave: Training')).toBeInTheDocument()
    expect(within(first).getAllByRole('button').map((b) => b.textContent.slice(0, 8))).toEqual(['9:30 AM ', '2:00 PM '])
    expect(within(sections[1]).getByText('No appointments.')).toBeInTheDocument()

    await user.click(within(first).getByRole('button', { name: /Early Edna/ }))
    expect(screen.getByRole('dialog', { name: 'Appointment details' })).toBeInTheDocument()
  })
})

describe('Doctor detail drawer', () => {
  it('summarises the profile and weekly schedule', async () => {
    const user = userEvent.setup()
    mockApi({
      'GET /admin/specialities': ok(specialities),
      'GET /admin/doctors': ok(paginated([doctor({ schedule: { slotMinutes: 20, weekly: [{ day: 1, start: '09:00', end: '12:00', breaks: [{ start: '10:00', end: '10:20' }] }] } })])),
    })
    renderWithProviders(<Doctors />)
    await user.click(await screen.findByRole('button', { name: 'Dr. Asha Rao' }))
    const drawer = screen.getByRole('dialog', { name: 'Doctor profile' })
    expect(within(drawer).getByText('Weekly schedule (20 minute slots)')).toBeInTheDocument()
    expect(within(drawer).getByText(/9:00 AM to 12:00 PM/)).toBeInTheDocument()
    expect(within(drawer).getByText('Break 10:00 AM to 10:20 AM')).toBeInTheDocument()
    expect(within(drawer).getAllByText('Day off')).toHaveLength(6)
    expect(within(drawer).getByText('Accepting bookings')).toBeInTheDocument()
  })
})
