import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Avatar from './Avatar'
import ConfirmDialog from './ConfirmDialog'
import Modal from './Modal'
import Pagination from './Pagination'
import StarRating from './StarRating'
import Tabs from './Tabs'

function ModalHarness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        open={open}
        title="Edit thing"
        onClose={() => {
          onClose()
          setOpen(false)
        }}
        footer={<button>Save</button>}
      >
        <input aria-label="Name" />
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('is an accessible dialog that focuses its first field', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit thing' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const field = screen.getByLabelText('Name')
    const save = screen.getByRole('button', { name: 'Save' })
    const close = screen.getByRole('button', { name: 'Close dialog' })

    await user.tab()
    expect(save).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab()
    expect(field).toHaveFocus()
    await user.tab({ shift: true })
    expect(close).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ModalHarness onClose={onClose} />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('locks page scroll while open and restores it afterwards', async () => {
    const user = userEvent.setup()
    render(<ModalHarness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    expect(document.body.style.overflow).toBe('')
  })

  it('does not close when dismissing is disabled', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Modal open title="Busy" onClose={onClose} dismissible={false}>body</Modal>)
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument()
  })
})

describe('ConfirmDialog', () => {
  it('confirms and cancels', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(<ConfirmDialog open title="Delete?" message="Really?" confirmLabel="Yes, delete" tone="danger" onConfirm={onConfirm} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('marks the current page, collapses long ranges and disables the edges', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Pagination page={1} totalPages={20} onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Page 20' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Page 10' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await user.click(screen.getByRole('button', { name: 'Page 20' }))
    expect(onChange.mock.calls).toEqual([[2], [20]])
  })
})

describe('Tabs', () => {
  it('supports arrow key navigation and exposes the selected tab', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [active, setActive] = useState('a')
      return (
        <Tabs tabs={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]} active={active} onChange={setActive} label="Letters">
          <p>Panel {active}</p>
        </Tabs>
      )
    }
    render(<Harness />)
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Alpha' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel b')
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveFocus()
  })
})

describe('StarRating', () => {
  it('is a radio group that reports the chosen value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<StarRating value={2} onChange={onChange} />)
    expect(screen.getByLabelText('2 stars')).toBeChecked()
    await user.click(screen.getByLabelText('4 stars'))
    expect(onChange).toHaveBeenCalledWith(4)
  })
})

describe('Avatar', () => {
  it('shows initials when there is no photo', () => {
    render(<Avatar name="Dr. Priya Nair" />)
    expect(screen.getByRole('img', { name: 'Dr. Priya Nair' })).toHaveTextContent('PN')
  })

  it('falls back to initials when the image fails to load', async () => {
    const { container } = render(<Avatar name="Asha Kumar" src="https://cdn.example.com/broken.png" />)
    const img = container.querySelector('img')
    img.dispatchEvent(new Event('error'))
    expect(await screen.findByText('AK')).toBeInTheDocument()
  })
})
