import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import OtpInput from './OtpInput'

function Harness({ initial = '' }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <OtpInput value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  )
}

const boxes = () => screen.getAllByLabelText(/Digit \d of 6/)
const value = () => screen.getByTestId('value').textContent

describe('OtpInput', () => {
  it('renders six labelled boxes', () => {
    render(<Harness />)
    expect(boxes()).toHaveLength(6)
    expect(boxes()[0]).toHaveAttribute('autocomplete', 'one-time-code')
  })

  it('advances focus as digits are typed', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(boxes()[0])
    await user.keyboard('123')
    expect(value()).toBe('123')
    expect(boxes()[3]).toHaveFocus()
  })

  it('ignores non-digit characters', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(boxes()[0])
    await user.keyboard('a1-b2')
    expect(value()).toBe('12')
  })

  it('fills every box when a code is pasted', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(boxes()[0])
    await user.paste('482 913')
    expect(value()).toBe('482913')
    expect(boxes().map((b) => b.value)).toEqual(['4', '8', '2', '9', '1', '3'])
  })

  it('truncates pasted codes longer than six digits', () => {
    render(<Harness />)
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => '1234567890' } })
    expect(value()).toBe('123456')
  })

  it('backspace on an empty box clears and focuses the previous one', async () => {
    const user = userEvent.setup()
    render(<Harness initial="12" />)
    await user.click(boxes()[2])
    await user.keyboard('{Backspace}')
    expect(value()).toBe('1')
    expect(boxes()[1]).toHaveFocus()
  })

  it('backspace on a filled box only clears that box', async () => {
    const user = userEvent.setup()
    render(<Harness initial="123" />)
    await user.click(boxes()[2])
    await user.keyboard('{Backspace}')
    expect(value()).toBe('12')
    expect(boxes()[2]).toHaveFocus()
  })

  it('moves between boxes with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness initial="123456" />)
    await user.click(boxes()[2])
    await user.keyboard('{ArrowLeft}')
    expect(boxes()[1]).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(boxes()[3]).toHaveFocus()
  })

  it('shows an error message', () => {
    render(<OtpInput value="" onChange={() => {}} error="Enter the 6-digit code" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the 6-digit code')
    expect(boxes()[0]).toHaveAttribute('aria-invalid', 'true')
  })
})
