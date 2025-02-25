import { useState } from 'react'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrescriptionBuilder from '../../src/components/appointments/PrescriptionBuilder'
import AppointmentActions from '../../src/components/appointments/AppointmentActions'
import { fail, mockApi, ok, body } from '../helpers/http'
import { withActions } from '../helpers/fixtures'
import { renderWithProviders } from '../helpers/render'

function Builder() {
  const [rows, setRows] = useState([])
  return <PrescriptionBuilder rows={rows} onChange={setRows} />
}

const fill = async (user, group, values) => {
  for (const [label, value] of Object.entries(values)) await user.type(within(group).getByLabelText(label), value)
}
const rowGroups = () => screen.getAllByRole('group', { name: /^Medicine \d+$/ })
const medicines = () => rowGroups().map((g) => within(g).getByLabelText('Medicine').value)

describe('PrescriptionBuilder', () => {
  it('adds, edits, reorders and removes rows', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Builder />)
    expect(screen.getByText('No medicines added.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add medicine' }))
    await user.click(screen.getByRole('button', { name: 'Add medicine' }))
    await user.click(screen.getByRole('button', { name: 'Add medicine' }))
    const groups = rowGroups()
    await user.type(within(groups[0]).getByLabelText('Medicine'), 'Alpha')
    await user.type(within(groups[1]).getByLabelText('Medicine'), 'Beta')
    await user.type(within(groups[2]).getByLabelText('Medicine'), 'Gamma')
    expect(medicines()).toEqual(['Alpha', 'Beta', 'Gamma'])

    expect(screen.getByRole('button', { name: 'Move medicine 1 up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move medicine 3 down' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move medicine 3 up' }))
    expect(medicines()).toEqual(['Alpha', 'Gamma', 'Beta'])
    await user.click(screen.getByRole('button', { name: 'Move medicine 1 down' }))
    expect(medicines()).toEqual(['Gamma', 'Alpha', 'Beta'])

    await user.click(screen.getByRole('button', { name: 'Remove medicine 2' }))
    expect(medicines()).toEqual(['Gamma', 'Beta'])
  })

  it('keeps typed values with their row when rows move', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Builder />)
    await user.click(screen.getByRole('button', { name: 'Add medicine' }))
    await user.click(screen.getByRole('button', { name: 'Add medicine' }))
    const [first] = rowGroups()
    await fill(user, first, { Medicine: 'One', Dosage: '5 mg' })
    await user.click(screen.getByRole('button', { name: 'Move medicine 1 down' }))
    const moved = rowGroups()[1]
    expect(within(moved).getByLabelText('Dosage')).toHaveValue('5 mg')
  })
})

describe('AppointmentActions follow appointment.actions', () => {
  const cases = [
    [{}, []],
    [{ canComplete: true }, ['Complete']],
    [{ canMarkNoShow: true }, ['No-show']],
    [{ canCancel: true }, ['Cancel']],
    [{ canComplete: true, canMarkNoShow: true, canCancel: true }, ['Complete', 'No-show', 'Cancel']],
  ]

  it.each(cases)('flags %j render buttons %j', (flags, expected) => {
    renderWithProviders(<AppointmentActions appointment={withActions(flags)} onUpdated={() => {}} />)
    expect(screen.queryAllByRole('button').map((b) => b.textContent)).toEqual(expected)
  })

  it('does not infer actions from status or date', () => {
    const past = withActions({}, { status: 'booked', date: '2020-01-01' })
    renderWithProviders(<AppointmentActions appointment={past} onUpdated={() => {}} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('requires a reason to cancel, then sends it', async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    const updated = withActions({}, { status: 'cancelled' })
    const calls = mockApi({ 'PATCH /appointments/:id/cancel': ok(updated) })
    renderWithProviders(<AppointmentActions appointment={withActions({ canCancel: true })} onUpdated={onUpdated} />)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Cancel appointment' }))
    expect(screen.getByText('Please give a reason of at least 3 characters')).toBeInTheDocument()
    expect(calls).toHaveLength(0)

    await user.type(screen.getByLabelText(/Reason/), 'Emergency surgery')
    await user.click(screen.getByRole('button', { name: 'Cancel appointment' }))
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated))
    expect(calls[0].url).toBe('/appointments/a1/cancel')
    expect(body(calls[0])).toEqual({ reason: 'Emergency surgery' })
  })

  it('marks a no-show only after confirmation', async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    const calls = mockApi({ 'PATCH /appointments/:id/no-show': ok(withActions({}, { status: 'no_show' })) })
    renderWithProviders(<AppointmentActions appointment={withActions({ canMarkNoShow: true })} onUpdated={onUpdated} />)
    await user.click(screen.getByRole('button', { name: 'No-show' }))
    expect(calls).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Mark no-show' }))
    await waitFor(() => expect(onUpdated).toHaveBeenCalled())
    expect(calls[0].url).toBe('/appointments/a1/no-show')
  })

  it('completes with notes and a validated prescription', async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    const calls = mockApi({ 'PATCH /appointments/:id/complete': ok(withActions({}, { status: 'completed' })) })
    renderWithProviders(<AppointmentActions appointment={withActions({ canComplete: true })} onUpdated={onUpdated} />)

    await user.click(screen.getByRole('button', { name: 'Complete' }))
    await user.type(screen.getByLabelText('Consultation notes'), 'Mild infection')
    await user.click(screen.getByRole('button', { name: 'Add medicine' }))
    await user.click(screen.getByRole('button', { name: 'Complete appointment' }))
    expect(screen.getByText('Medicine is required')).toBeInTheDocument()
    expect(screen.getByText('1 to 365 days')).toBeInTheDocument()
    expect(calls).toHaveLength(0)

    const group = screen.getByRole('group', { name: 'Medicine 1' })
    await fill(user, group, { Medicine: 'Amoxicillin', Dosage: '250 mg', Frequency: 'Thrice a day', 'Duration (days)': '7', Instructions: 'After meals' })
    await user.click(screen.getByRole('button', { name: 'Complete appointment' }))
    await waitFor(() => expect(onUpdated).toHaveBeenCalled())
    expect(body(calls[0])).toEqual({
      notes: 'Mild infection',
      prescription: [{ medicine: 'Amoxicillin', dosage: '250 mg', frequency: 'Thrice a day', durationDays: 7, instructions: 'After meals' }],
    })
  })

  it('can complete without any medicines', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'PATCH /appointments/:id/complete': ok(withActions({}, { status: 'completed' })) })
    renderWithProviders(<AppointmentActions appointment={withActions({ canComplete: true })} onUpdated={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Complete' }))
    await user.click(screen.getByRole('button', { name: 'Complete appointment' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(body(calls[0])).toEqual({ notes: '', prescription: [] })
  })

  it('keeps the dialog open and reports server rejections', async () => {
    const user = userEvent.setup()
    const onUpdated = vi.fn()
    mockApi({ 'PATCH /appointments/:id/complete': fail(422, 'INVALID_STATE', 'Too early') })
    renderWithProviders(<AppointmentActions appointment={withActions({ canComplete: true })} onUpdated={onUpdated} />)
    await user.click(screen.getByRole('button', { name: 'Complete' }))
    await user.click(screen.getByRole('button', { name: 'Complete appointment' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete appointment' })).not.toBeDisabled())
    expect(onUpdated).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Complete consultation' })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
