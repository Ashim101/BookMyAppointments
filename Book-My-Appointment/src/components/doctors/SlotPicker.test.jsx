import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { makeSlots } from '../../test/factories'
import { fail, mockApi, ok } from '../../test/http'
import SlotPicker from './SlotPicker'

const week1 = makeSlots(
  [
    ['2026-12-10', ['09:00', '09:30', '14:00']],
    ['2026-12-11', ['09:00']],
    ['2026-12-12', []],
  ],
  ['2026-12-10 09:30', '2026-12-11 09:00'],
)
const week2 = makeSlots([['2026-12-17', ['10:00', '10:30']]])

const publicSettings = { cancellationCutoffHours: 24, bookingWindowDays: 14, timezone: 'Asia/Kolkata', currency: 'INR' }
const slotCalls = (calls) => calls.filter((c) => c.url.endsWith('/slots'))

function setup(handler, { settings = publicSettings, ...props } = {}) {
  const calls = mockApi((config) => (config.url === '/settings/public' ? ok(settings) : handler(config)))
  const onSelect = vi.fn()
  render(<SlotPicker doctorId="d1" selected={null} onSelect={onSelect} {...props} />)
  return { calls, onSelect }
}

describe('SlotPicker', () => {
  it('fetches slots from the API and shows the clinic timezone', async () => {
    const { calls } = setup(() => ok(week1))
    expect(await screen.findByRole('button', { name: '9:00 AM' })).toBeInTheDocument()
    expect(slotCalls(calls)[0].url).toBe('/doctors/d1/slots')
    expect(slotCalls(calls)[0].params).toEqual({ from: undefined, days: 7 })
    expect(screen.getByText(/Asia\/Kolkata \(GMT\+5:30\)/)).toBeInTheDocument()
  })

  it('disables unavailable slots and days without free slots', async () => {
    setup(() => ok(week1))
    expect(await screen.findByRole('button', { name: '9:30 AM' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '9:00 AM' })).toBeEnabled()
    const fullDays = screen.getAllByRole('button', { name: /Full/ })
    expect(fullDays).toHaveLength(2)
    fullDays.forEach((d) => expect(d).toBeDisabled())
  })

  it('reports the chosen slot', async () => {
    const user = userEvent.setup()
    const { onSelect } = setup(() => ok(week1))
    await user.click(await screen.findByRole('button', { name: '2:00 PM' }))
    expect(onSelect).toHaveBeenCalledWith({ date: '2026-12-10', time: '14:00' })
  })

  it('marks the selected slot as pressed', async () => {
    setup(() => ok(week1), { selected: { date: '2026-12-10', time: '14:00' } })
    expect(await screen.findByRole('button', { name: '2:00 PM' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '9:00 AM' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('navigates to the next and previous week using the first returned day as the anchor', async () => {
    const user = userEvent.setup()
    const { calls } = setup((config) => ok(config.params.from === '2026-12-17' ? week2 : week1))
    await screen.findByRole('button', { name: '9:00 AM' })
    expect(screen.getByRole('button', { name: /Previous week/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /Next week/ }))
    expect(await screen.findByRole('button', { name: '10:30 AM' })).toBeInTheDocument()
    expect(slotCalls(calls).at(-1).params.from).toBe('2026-12-17')

    await user.click(screen.getByRole('button', { name: /Previous week/ }))
    expect(await screen.findByRole('button', { name: '2:00 PM' })).toBeInTheDocument()
    expect(slotCalls(calls).at(-1).params.from).toBeUndefined()
  })

  it('stops offering further weeks once a later week has no openings', async () => {
    const user = userEvent.setup()
    setup((config) => ok(config.params.from ? makeSlots([['2026-12-17', []]]) : week1))
    await screen.findByRole('button', { name: '9:00 AM' })
    await user.click(screen.getByRole('button', { name: /Next week/ }))
    expect(await screen.findByText(/No times are open this week/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next week/ })).toBeDisabled()
  })

  it('stops week navigation at the end of the booking window from the public settings', async () => {
    const user = userEvent.setup()
    // Window of 10 days from 2026-12-10 ends on 2026-12-20, so the week starting 2026-12-24 is out of reach.
    const { calls } = setup((config) => ok(config.params.from === '2026-12-17' ? week2 : week1), {
      settings: { ...publicSettings, bookingWindowDays: 10 },
    })
    await screen.findByRole('button', { name: '9:00 AM' })
    const next = screen.getByRole('button', { name: /Next week/ })
    await waitFor(() => expect(next).toBeEnabled())
    await user.click(next)
    expect(await screen.findByRole('button', { name: '10:30 AM' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Next week/ })).toBeDisabled())
    expect(slotCalls(calls).map((c) => c.params.from)).toEqual([undefined, '2026-12-17'])
  })

  it('allows the last week when the window reaches into it', async () => {
    const user = userEvent.setup()
    setup((config) => ok(config.params.from === '2026-12-17' ? week2 : week1), { settings: { ...publicSettings, bookingWindowDays: 7 } })
    await screen.findByRole('button', { name: '9:00 AM' })
    await waitFor(() => expect(screen.getByRole('button', { name: /Next week/ })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: /Next week/ }))
    expect(await screen.findByRole('button', { name: '10:30 AM' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next week/ })).toBeDisabled()
  })

  it('switches the time grid when another day is chosen', async () => {
    const user = userEvent.setup()
    setup(() => ok(makeSlots([['2026-12-10', ['09:00']], ['2026-12-11', ['16:00']]])))
    await screen.findByRole('button', { name: '9:00 AM' })
    await user.click(screen.getByRole('button', { name: /11 Dec/ }))
    expect(screen.getByRole('button', { name: '4:00 PM' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '9:00 AM' })).not.toBeInTheDocument()
  })

  it('refetches when refreshKey changes', async () => {
    const calls = mockApi(() => ok(week1))
    const { rerender } = render(<SlotPicker doctorId="d1" selected={null} onSelect={() => {}} refreshKey={0} />)
    await screen.findByRole('button', { name: '9:00 AM' })
    rerender(<SlotPicker doctorId="d1" selected={null} onSelect={() => {}} refreshKey={1} />)
    await waitFor(() => expect(calls).toHaveLength(2))
  })

  it('shows an error state with retry', async () => {
    const user = userEvent.setup()
    let attempt = 0
    setup(() => (attempt++ === 0 ? fail(500, 'INTERNAL') : ok(week1)))
    expect(await screen.findByRole('alert')).toHaveTextContent(/went wrong on our side/)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: '9:00 AM' })).toBeInTheDocument()
  })
})
