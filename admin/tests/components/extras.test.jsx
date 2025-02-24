import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeekGrid, { PX_PER_HOUR } from '../../src/components/calendar/WeekGrid'
import DateRangePicker from '../../src/components/ui/DateRangePicker'
import PageHeader from '../../src/components/PageHeader'
import Settings from '../../src/pages/admin/Settings'
import { usePageTitle } from '../../src/hooks/usePageTitle'
import { RANGE_PRESETS, addDays, daysAgoISO, todayISO, weekDates } from '../../src/lib/date'
import { mockApi, ok } from '../helpers/http'
import { renderWithProviders } from '../helpers/render'

describe('WeekGrid current-time indicator', () => {
  const props = (now) => ({
    dates: weekDates('2026-11-02'),
    appointmentsByDate: {},
    schedule: { slotMinutes: 30, weekly: [] },
    leaves: [],
    bounds: { startHour: 8, endHour: 18 },
    onSelect: () => {},
    now,
  })

  it('draws a line on today at the current time', () => {
    renderWithProviders(<WeekGrid {...props(new Date(2026, 10, 4, 10, 30))} />)
    const line = screen.getByTestId('now-indicator')
    expect(line).toHaveStyle({ top: `${2.5 * PX_PER_HOUR}px` })
    expect(screen.getByTestId('day-2026-11-04')).toContainElement(line)
  })

  it('hides the line outside the visible hours or for other weeks', () => {
    const { unmount } = renderWithProviders(<WeekGrid {...props(new Date(2026, 10, 4, 22, 0))} />)
    expect(screen.queryByTestId('now-indicator')).not.toBeInTheDocument()
    unmount()
    renderWithProviders(<WeekGrid {...props(new Date(2026, 11, 20, 10, 0))} />)
    expect(screen.queryByTestId('now-indicator')).not.toBeInTheDocument()
  })
})

describe('DateRangePicker presets', () => {
  it('fills the range from a preset and clears it', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<DateRangePicker presets from="" to="" onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Clear dates' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    expect(onChange).toHaveBeenCalledWith({ from: daysAgoISO(6), to: todayISO() })
    await user.click(screen.getByRole('button', { name: 'Next 7 days' }))
    expect(onChange).toHaveBeenLastCalledWith({ from: todayISO(), to: addDays(todayISO(), 6) })
    rerender(<DateRangePicker presets from="2026-01-01" to="" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Clear dates' }))
    expect(onChange).toHaveBeenLastCalledWith({ from: '', to: '' })
  })

  it('has no preset buttons by default', () => {
    render(<DateRangePicker from="" to="" onChange={() => {}} />)
    expect(screen.queryByRole('group', { name: 'Quick ranges' })).not.toBeInTheDocument()
    expect(RANGE_PRESETS.map((p) => p.range().from <= p.range().to)).toEqual([true, true, true, true])
  })
})

describe('page titles', () => {
  it('sets and updates the document title', () => {
    const { rerender } = render(<PageHeader title="Doctors" />)
    expect(document.title).toBe('Doctors | BookMyAppointments Staff')
    rerender(<PageHeader title="Patients" />)
    expect(document.title).toBe('Patients | BookMyAppointments Staff')
    renderHook(() => usePageTitle(''))
    expect(document.title).toBe('BookMyAppointments Staff')
  })
})

describe('Settings dirty state', () => {
  const settings = { cancellationCutoffHours: 24, bookingWindowDays: 30, defaultSlotMinutes: 30, currency: 'INR', timezone: 'Asia/Kolkata' }

  it('disables save until something changes and can reset edits', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /admin/settings': ok(settings) })
    renderWithProviders(<Settings />)
    const save = await screen.findByRole('button', { name: 'Save settings' })
    expect(save).toBeDisabled()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/Booking window/), '5')
    expect(save).toBeEnabled()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByLabelText(/Booking window/)).toHaveValue('30')
    expect(save).toBeDisabled()
  })
})
