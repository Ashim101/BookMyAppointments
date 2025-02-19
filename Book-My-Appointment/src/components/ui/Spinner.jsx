import { cx } from './cx'

export default function Spinner({ size = 20, label = 'Loading', className }) {
  return (
    <span role="status" className={cx('inline-flex items-center', className)}>
      <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function PageSpinner({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-brand-600">
      <Spinner size={36} label={label} />
    </div>
  )
}
