import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScheduleEditor from '../../src/components/schedule/ScheduleEditor'

const schedule = {
  slotMinutes: 30,
  weekly: [{ day: 1, start: '10:00', end: '13:00', breaks: [{ start: '11:00', end: '11:30' }] }],
}

const setTime = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const preview = () => screen.getByRole('region', { name: 'Slot preview' })

describe('ScheduleEditor', () => {
  it('renders every weekday with the enabled ones switched on', () => {
    render(<ScheduleEditor schedule={schedule} onSave={() => {}} />)
    expect(screen.getAllByRole('switch')).toHaveLength(7)
    expect(screen.getByRole('switch', { name: 'Monday working day' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Tuesday working day' })).not.toBeChecked()
    expect(screen.getByLabelText('Monday start')).toHaveValue('10:00')
    expect(screen.getAllByText('Day off')).toHaveLength(6)
  })

  it('previews the slots a day would generate, skipping the break', () => {
    render(<ScheduleEditor schedule={schedule} onSave={() => {}} />)
    expect(within(preview()).getByText('Slot preview (5 slots)')).toBeInTheDocument()
    expect(within(preview()).getByText('10:00 AM')).toBeInTheDocument()
    expect(within(preview()).queryByText('11:00 AM')).not.toBeInTheDocument()
    expect(within(preview()).getByText('11:30 AM')).toBeInTheDocument()
  })

  it('updates the preview live when the slot length changes', async () => {
    const user = userEvent.setup()
    render(<ScheduleEditor schedule={schedule} onSave={() => {}} />)
    await user.selectOptions(screen.getByLabelText('Slot length'), '60')
    expect(within(preview()).getByText('Slot preview (2 slots)')).toBeInTheDocument()
  })

  it('shows inline errors and blocks saving when start is not before end', () => {
    const onSave = vi.fn()
    render(<ScheduleEditor schedule={schedule} onSave={onSave} />)
    setTime('Monday end', '09:00')
    expect(screen.getByRole('alert')).toHaveTextContent('Working hours must start before it ends')
    expect(screen.getByRole('button', { name: 'Save schedule' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('button', { name: 'Save schedule' }).closest('form'))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('flags breaks outside working hours and overlapping breaks', async () => {
    const user = userEvent.setup()
    render(<ScheduleEditor schedule={schedule} onSave={() => {}} />)
    setTime('Monday break 1 start', '09:00')
    expect(screen.getByRole('alert')).toHaveTextContent('Break must be inside working hours')
    setTime('Monday break 1 start', '11:00')
    await user.click(screen.getByRole('button', { name: 'Add break on Monday' }))
    setTime('Monday break 2 start', '11:15')
    setTime('Monday break 2 end', '12:00')
    expect(screen.getByRole('alert')).toHaveTextContent('Breaks must not overlap')
    await user.click(screen.getByRole('button', { name: 'Remove Monday break 2' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('requires at least one working day', async () => {
    const user = userEvent.setup()
    render(<ScheduleEditor schedule={schedule} onSave={() => {}} />)
    await user.click(screen.getByRole('switch', { name: 'Monday working day' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enable at least one working day')
    expect(screen.getByRole('button', { name: 'Save schedule' })).toBeDisabled()
  })

  it('saves the edited schedule in API shape', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<ScheduleEditor schedule={schedule} onSave={onSave} />)
    await user.click(screen.getByRole('switch', { name: 'Wednesday working day' }))
    setTime('Wednesday end', '12:00')
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))
    expect(onSave).toHaveBeenCalledWith({
      slotMinutes: 30,
      weekly: [
        { day: 1, start: '10:00', end: '13:00', breaks: [{ start: '11:00', end: '11:30' }] },
        { day: 3, start: '09:00', end: '12:00', breaks: [] },
      ],
    })
  })
})
