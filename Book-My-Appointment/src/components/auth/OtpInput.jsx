import { useRef } from 'react'
import { cx } from '../ui/cx'

const LENGTH = 6

/** Six single-digit boxes with paste, auto-advance and backspace navigation. `value` is a string of up to 6 digits. */
export default function OtpInput({ value, onChange, disabled, error, label = 'Verification code' }) {
  const refs = useRef([])
  const chars = value.padEnd(LENGTH, ' ').split('')

  const emit = (next) => onChange(next.join('').replace(/\s+$/, ''))
  const focusBox = (index) => refs.current[Math.min(Math.max(index, 0), LENGTH - 1)]?.focus()

  const fill = (start, digits) => {
    const next = [...chars]
    digits.split('').forEach((digit, offset) => {
      if (start + offset < LENGTH) next[start + offset] = digit
    })
    emit(next)
    focusBox(start + digits.length)
  }

  const onInput = (index, event) => {
    const digits = event.target.value.replace(/\D/g, '')
    if (!digits) {
      const next = [...chars]
      next[index] = ' '
      emit(next)
      return
    }
    fill(index, digits.length > 1 ? digits : digits.slice(-1))
  }

  const onKeyDown = (index, event) => {
    if (event.key === 'Backspace' && chars[index] === ' ' && index > 0) {
      event.preventDefault()
      const next = [...chars]
      next[index - 1] = ' '
      emit(next)
      focusBox(index - 1)
    } else if (event.key === 'ArrowLeft') {
      focusBox(index - 1)
    } else if (event.key === 'ArrowRight') {
      focusBox(index + 1)
    }
  }

  const onPaste = (index, event) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '')
    if (!digits) return
    event.preventDefault()
    fill(index === 0 ? 0 : index, digits.slice(0, LENGTH))
  }

  return (
    <fieldset aria-describedby={error ? 'otp-error' : undefined}>
      <legend className="mb-2 text-sm font-medium text-ink-700">{label}</legend>
      <div className="flex gap-2">
        {chars.map((char, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el
            }}
            value={char.trim()}
            onChange={(e) => onInput(index, e)}
            onKeyDown={(e) => onKeyDown(index, e)}
            onPaste={(e) => onPaste(index, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            className={cx(
              'h-12 w-10 rounded-lg border bg-white text-center text-lg font-semibold sm:w-12',
              error ? 'border-red-500' : 'border-slate-300',
            )}
          />
        ))}
      </div>
      {error && (
        <p id="otp-error" role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}
