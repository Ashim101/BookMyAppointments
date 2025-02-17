import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import Spinner from './Spinner'
import { cx } from './cx'

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary: 'bg-white text-ink-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-ink-300',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-ink-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
}
const SIZES = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }

function buttonClasses({ variant = 'primary', size = 'md', className } = {}) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
    'disabled:cursor-not-allowed',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

const Button = forwardRef(function Button(
  { variant, size, loading = false, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...rest}
    >
      {loading && <Spinner size={16} label="Working" />}
      {children}
    </button>
  )
})

export function ButtonLink({ variant, size, className, ...rest }) {
  return <Link className={buttonClasses({ variant, size, className })} {...rest} />
}

export default Button
