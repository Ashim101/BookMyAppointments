import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeekGrid, { PX_PER_HOUR } from '../../src/components/calendar/WeekGrid'
import Calendar from '../../src/pages/doctor/Calendar'
import { addDays, startOfWeek, todayISO, weekDates } from '../../src/lib/date'
import { mockApi, ok } from '../helpers/http'
import { paginated, withActions } from '../helpers/fixtures'
import { renderWithProviders } from '../helpers/render'

const monday = '2026-11-02'
const schedule = {
  slotMinutes: 30,
  weekly: [
    { day: 1, start: '09:00', end: '17:00', breaks: [{ start: '13:00', end: '14:00' }] },
    { day: 2, start: '09:00', end: '17:00', breaks: [] },
  ],
}
const bounds = { startHour: 8, endHour: 18 }
const appt = (o) => withActions({}, { date: monday, time: '10:30', startsAt: '2026-11-02T05:00:00Z', endsAt: '2026-11-02T05:45:00Z', ...o })

describe('WeekGrid', () => {
  const render = (props = {}) =>
    renderWithProviders(
      <WeekGrid
        dates={weekDates(monday)}
        appointmentsByDate={{ [monday]: [appt({ id: 'x1' })] }}
        schedule={schedule}
        leaves={[]}
        bounds={bounds}
        onSelect={() => {}}
        {...props}
      />,
    )

  it('positions an appointment by start time and duration', () => {
    render()
    const block = screen.getByRole('button', { name: /10:30 AM Pat Ient/ })
    expect(block).toHaveStyle({ top: `${2.5 * PX_PER_HOUR}px`, height: `${0.75 * PX_PER_HOUR}px` })
    expect(within(screen.getByTestId(`day-${monday}`)).getByRole('button')).toBe(block)
  })

  it('shades time outside working hours, breaks and days off', () => {
    render()
    const mondayBlocks = within(screen.getByTestId(`day-${monday}`)).getAllByTestId('unavailable')
    expect(mondayBlocks.map((b) => [b.style.top, b.style.height])).toEqual([
      ['0px', `${PX_PER_HOUR}px`],
      [`${9 * PX_PER_HOUR}px`, `${PX_PER_HOUR}px`],
      [`${5 * PX_PER_HOUR}px`, `${PX_PER_HOUR}px`],
    ])
    const wednesday = within(screen.getByTestId('day-2026-11-04')).getAllByTestId('unavailable')
    expect(wednesday).toHaveLength(1)
    expect(wednesday[0]).toHaveStyle({ height: `${10 * PX_PER_HOUR}px` })
  })

  it('marks leave days and reports clicks', async () => {
    const onSelect = vi.fn()
    render({ leaves: [{ id: 'l1', date: '2026-11-03', reason: 'Conference' }], onSelect })
    expect(screen.getByText('On leave')).toBeInTheDocument()
    expect(within(screen.getByTestId('day-2026-11-03')).getByTestId('leave')).toHaveAttribute('title', 'Conference')
    await userEvent.click(screen.getByRole('button', { name: /Pat Ient/ }))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'x1' }))
  })
})

describe('Calendar page', () => {
  const thisMonday = startOfWeek(todayISO())

  const setup = () => {
    const booking = appt({ id: 'a-today', date: thisMonday, actions: { canCancel: true } })
    const calls = mockApi({
      'GET /doctor/schedule': ok(schedule),
      'GET /doctor/leaves': ok([]),
      'GET /appointments': ok(paginated([booking, appt({ id: 'gone', status: 'cancelled', date: thisMonday, time: '15:00' })])),
    })
    return calls
  }
  const weekCalls = (calls) => calls.filter((c) => c.url === '/appointments').map((c) => c.params)

  it('loads the current week and ignores cancelled appointments', async () => {
    const calls = setup()
    renderWithProviders(<Calendar />, { role: 'doctor' })
    expect(await screen.findAllByRole('button', { name: /Pat Ient/ })).toHaveLength(1)
    expect(weekCalls(calls)[0]).toMatchObject({ from: thisMonday, to: addDays(thisMonday, 6), limit: 100 })
  })

  it('navigates between weeks with buttons, Today and the keyboard', async () => {
    const user = userEvent.setup()
    const calls = setup()
    renderWithProviders(<Calendar />, { role: 'doctor' })
    await screen.findAllByRole('button', { name: /Pat Ient/ })

    await user.click(screen.getByRole('button', { name: 'Next week' }))
    await waitFor(() => expect(weekCalls(calls).at(-1).from).toBe(addDays(thisMonday, 7)))
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    await user.click(screen.getByRole('button', { name: 'Previous week' }))
    await waitFor(() => expect(weekCalls(calls).at(-1).from).toBe(addDays(thisMonday, -7)))
    await user.click(screen.getByRole('button', { name: 'Today' }))
    await waitFor(() => expect(weekCalls(calls).at(-1).from).toBe(thisMonday))

    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(weekCalls(calls).at(-1).from).toBe(addDays(thisMonday, 7)))
    await user.keyboard('t')
    await waitFor(() => expect(weekCalls(calls).at(-1).from).toBe(thisMonday))
  })

  it('opens the appointment detail with only the permitted actions', async () => {
    const user = userEvent.setup()
    setup()
    renderWithProviders(<Calendar />, { role: 'doctor' })
    await user.click(await screen.findByRole('button', { name: /Pat Ient/ }))
    const drawer = screen.getByRole('dialog', { name: 'Appointment details' })
    expect(within(drawer).getByText('Persistent cough')).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(within(drawer).queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Patient history' })).toBeInTheDocument()
  })

  it('does not change weeks while typing in a dialog field', async () => {
    const user = userEvent.setup()
    const calls = setup()
    renderWithProviders(<Calendar />, { role: 'doctor' })
    await user.click(await screen.findByRole('button', { name: /Pat Ient/ }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.type(screen.getByLabelText(/Reason/), 'abc{ArrowRight}t')
    expect(weekCalls(calls)).toHaveLength(1)
  })
})
