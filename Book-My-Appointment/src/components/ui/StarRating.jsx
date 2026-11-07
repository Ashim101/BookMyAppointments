import { useId, useState } from 'react'
import { FaStar } from 'react-icons/fa'
import { cx } from './cx'

export function RatingDisplay({ average, count, className }) {
  if (!count) return <span className={cx('text-xs text-ink-500', className)}>No reviews yet</span>
  return (
    <span className={cx('inline-flex items-center gap-1 text-sm', className)} aria-label={`Rated ${average} out of 5 from ${count} reviews`}>
      <FaStar className="text-amber-400" aria-hidden="true" />
      <span className="font-semibold text-ink-900">{average.toFixed(1)}</span>
      <span className="text-ink-500">({count})</span>
    </span>
  )
}

export function StarsDisplay({ value, size = 16 }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <FaStar key={n} size={size} className={n <= value ? 'text-amber-400' : 'text-slate-300'} aria-hidden="true" />
      ))}
    </span>
  )
}

/** Accessible radio-group star input. Arrow keys move between stars natively. */
export default function StarRating({ value, onChange, label = 'Rating', error }) {
  const name = useId()
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <fieldset aria-invalid={error ? true : undefined}>
      <legend className="mb-1 text-sm font-medium text-ink-700">{label}</legend>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
              aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            />
            <FaStar
              size={28}
              aria-hidden="true"
              className={cx('rounded transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500', n <= shown ? 'text-amber-400' : 'text-slate-300')}
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}
