import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Leaves from '../../src/pages/doctor/Leaves'
import { addDays, todayISO } from '../../src/lib/date'
import { body, fail, mockApi, ok } from '../helpers/http'
import { renderWithProviders } from '../helpers/render'

const future = addDays(todayISO(), 10)

const fillForm = async (user, date = future, reason = 'Conference') => {
  await user.type(screen.getByLabelText('Date'), date)
  await user.type(screen.getByLabelText('Reason'), reason)
}

describe('Leaves', () => {
  it('lists upcoming leaves and shows the empty state', async () => {
    mockApi({ 'GET /doctor/leaves': ok([{ id: 'l1', date: future, reason: 'Conference' }]) })
    renderWithProviders(<Leaves />)
    expect(await screen.findByText('Conference')).toBeInTheDocument()
  })

  it('validates before sending', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /doctor/leaves': ok([]) })
    renderWithProviders(<Leaves />)
    await screen.findByText('No upcoming leaves.')
    await user.click(screen.getByRole('button', { name: 'Add leave' }))
    expect(screen.getByText('Choose a date')).toBeInTheDocument()
    expect(screen.getByText('Give a reason')).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'post')).toHaveLength(0)
  })

  it('adds a leave without conflict', async () => {
    const user = userEvent.setup()
    let leaves = []
    const calls = mockApi({
      'GET /doctor/leaves': () => ok(leaves),
      'POST /doctor/leaves': (config) => {
        leaves = [{ id: 'l1', ...body(config) }]
        return ok(leaves[0])
      },
    })
    renderWithProviders(<Leaves />)
    await screen.findByText('No upcoming leaves.')
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add leave' }))
    expect(await screen.findByText('Conference')).toBeInTheDocument()
    expect(body(calls.find((c) => c.method === 'post'))).toEqual({ date: future, reason: 'Conference' })
  })

  it('offers to cancel bookings on 409 and retries with cancelAppointments', async () => {
    const user = userEvent.setup()
    let leaves = []
    const calls = mockApi({
      'GET /doctor/leaves': () => ok(leaves),
      'POST /doctor/leaves': (config) => {
        if (!body(config).cancelAppointments) return fail(409, 'CONFLICT', '2 booked appointments exist on that day.')
        leaves = [{ id: 'l1', date: body(config).date, reason: body(config).reason }]
        return ok(leaves[0])
      },
    })
    renderWithProviders(<Leaves />)
    await screen.findByText('No upcoming leaves.')
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add leave' }))

    const dialog = await screen.findByRole('dialog', { name: 'Bookings exist on this day' })
    expect(dialog).toHaveTextContent('2 booked appointments exist on that day.')
    expect(calls.filter((c) => c.method === 'post')).toHaveLength(1)

    await user.click(within(dialog).getByRole('button', { name: 'Cancel appointments and add leave' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('cell', { name: 'Conference' })).toBeInTheDocument()
    const posts = calls.filter((c) => c.method === 'post').map(body)
    expect(posts).toEqual([
      { date: future, reason: 'Conference' },
      { date: future, reason: 'Conference', cancelAppointments: true },
    ])
  })

  it('leaves the form untouched when the doctor declines the cancellation', async () => {
    const user = userEvent.setup()
    const calls = mockApi({
      'GET /doctor/leaves': ok([]),
      'POST /doctor/leaves': fail(409, 'CONFLICT', 'Bookings exist.'),
    })
    renderWithProviders(<Leaves />)
    await screen.findByText('No upcoming leaves.')
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Add leave' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Reason')).toHaveValue('Conference')
    expect(calls.filter((c) => c.method === 'post')).toHaveLength(1)
  })

  it('deletes a leave after confirmation', async () => {
    const user = userEvent.setup()
    let leaves = [{ id: 'l1', date: future, reason: 'Conference' }]
    const calls = mockApi({
      'GET /doctor/leaves': () => ok(leaves),
      'DELETE /doctor/leaves/:id': () => {
        leaves = []
        return ok(null)
      },
    })
    renderWithProviders(<Leaves />)
    await user.click(await screen.findByRole('button', { name: `Delete leave on ${future}` }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('No upcoming leaves.')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'delete').url).toBe('/doctor/leaves/l1')
  })
})
