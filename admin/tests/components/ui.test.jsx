import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '../../src/components/ui/Modal'
import Drawer from '../../src/components/ui/Drawer'
import ConfirmDialog from '../../src/components/ui/ConfirmDialog'
import DataTable from '../../src/components/ui/DataTable'
import Pagination from '../../src/components/ui/Pagination'
import Tabs from '../../src/components/ui/Tabs'
import Toggle from '../../src/components/ui/Toggle'
import Avatar from '../../src/components/ui/Avatar'
import Input from '../../src/components/ui/Input'
import Select from '../../src/components/ui/Select'
import DateRangePicker from '../../src/components/ui/DateRangePicker'

function ModalHarness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => { setOpen(false); onClose() }} title="Edit thing" footer={<button>Save</button>}>
        <input aria-label="First" />
        <input aria-label="Second" />
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('is labelled, traps focus, closes on Escape and restores focus', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ModalHarness onClose={onClose} />)
    const trigger = screen.getByText('Open')
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Edit thing' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()

    await user.tab()
    expect(screen.getByLabelText('First')).toHaveFocus()
    await user.tab()
    await user.tab()
    expect(screen.getByText('Save')).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByText('Save')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalledOnce()
    expect(trigger).toHaveFocus()
  })

  it('closes when the backdrop is pressed but not when the panel is', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} title="T">body</Modal>)
    await user.click(screen.getByText('body'))
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('dialog').parentElement)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('Drawer and ConfirmDialog', () => {
  it('drawer renders content and closes with its button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Drawer open onClose={onClose} title="Details">content</Drawer>)
    expect(screen.getByRole('dialog', { name: 'Details' })).toHaveTextContent('content')
    await user.click(screen.getByRole('button', { name: 'Close panel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('confirm dialog focuses Cancel first and reports choices', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog open title="Delete?" message="Really?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'fee', header: 'Fee', sortable: true, render: (r) => `Rs ${r.fee}` },
  ]
  const rows = [
    { id: 1, name: 'Bea', fee: 300 },
    { id: 2, name: 'Al', fee: 900 },
    { id: 3, name: 'Cy', fee: 100 },
  ]
  const names = () => screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)

  it('sorts ascending, descending and back to the original order', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} rows={rows} />)
    expect(names()).toEqual(['Bea', 'Al', 'Cy'])
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(names()).toEqual(['Al', 'Bea', 'Cy'])
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'ascending')
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(names()).toEqual(['Cy', 'Bea', 'Al'])
    await user.click(screen.getByRole('button', { name: 'Name' }))
    expect(names()).toEqual(['Bea', 'Al', 'Cy'])
    await user.click(screen.getByRole('button', { name: 'Fee' }))
    expect(names()).toEqual(['Cy', 'Bea', 'Al'])
  })

  it('shows skeleton rows while loading', () => {
    render(<DataTable columns={columns} rows={[]} loading skeletonRows={3} />)
    expect(screen.getAllByTestId('skeleton-row')).toHaveLength(3)
    expect(screen.queryByText('Nothing to show yet.')).not.toBeInTheDocument()
  })

  it('shows the empty state', () => {
    render(<DataTable columns={columns} rows={[]} empty="No doctors" />)
    expect(screen.getByText('No doctors')).toBeInTheDocument()
  })

  it('activates rows by click and Enter', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(<DataTable columns={columns} rows={rows} onRowClick={onRowClick} />)
    await user.click(screen.getByText('Al'))
    expect(onRowClick).toHaveBeenCalledWith(rows[1])
    screen.getByText('Cy').closest('tr').focus()
    await user.keyboard('{Enter}')
    expect(onRowClick).toHaveBeenLastCalledWith(rows[2])
  })
})

describe('Pagination', () => {
  it('reports the visible range and disables edges', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Pagination page={1} totalPages={3} total={25} limit={10} onChange={onChange} />)
    expect(screen.getByText('Showing 1-10 of 25')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onChange).toHaveBeenCalledWith(2)
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<Pagination page={1} totalPages={0} total={0} limit={10} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('small controls', () => {
  it('tabs change with the arrow keys', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Tabs tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} value="a" onChange={onChange} />)
    screen.getByRole('tab', { name: 'A' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenCalledWith('b')
    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('b')
  })

  it('toggle exposes switch semantics', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} label="Available" />)
    const toggle = screen.getByRole('switch', { name: 'Available' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('avatar falls back to initials when there is no photo or it fails', () => {
    const { rerender } = render(<Avatar name="Dr. Asha Rao" />)
    expect(screen.getByRole('img', { name: 'Dr. Asha Rao' })).toHaveTextContent('AR')
    rerender(<Avatar name="Asha Rao" src="/missing.png" />)
    const img = screen.getByRole('img', { name: 'Asha Rao' })
    expect(img.tagName).toBe('IMG')
    fireEvent.error(img)
    expect(screen.getByRole('img', { name: 'Asha Rao' })).toHaveTextContent('AR')
  })

  it('fields link labels and errors', () => {
    render(
      <>
        <Input label="Email" error="Required" required />
        <Select label="Role" options={[{ value: 'a', label: 'A' }]} placeholder="Pick" />
      </>,
    )
    const input = screen.getByLabelText(/Email/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Required')
    expect(screen.getByLabelText('Role')).toHaveDisplayValue('Pick')
  })

  it('date range constrains the opposite input', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateRangePicker from="2026-01-01" to="2026-01-31" onChange={onChange} />)
    expect(screen.getByLabelText('From')).toHaveAttribute('max', '2026-01-31')
    expect(screen.getByLabelText('To')).toHaveAttribute('min', '2026-01-01')
    await user.clear(screen.getByLabelText('To'))
    expect(onChange).toHaveBeenCalledWith({ from: '2026-01-01', to: '' })
  })
})
