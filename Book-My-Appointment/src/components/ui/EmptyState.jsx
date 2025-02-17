import { FiAlertTriangle } from 'react-icons/fi'
import { errorMessage } from '../../lib/errors'
import Button from './Button'
import { cx } from './cx'

export default function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cx('flex flex-col items-center rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center', className)}>
      {icon && <div className="mb-4 text-brand-500">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }) {
  return (
    <div role="alert" className={cx('flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center', className)}>
      <FiAlertTriangle size={32} className="mb-3 text-red-600" aria-hidden="true" />
      <h3 className="text-lg font-semibold text-ink-900">We hit a snag</h3>
      <p className="mt-1 max-w-md text-sm text-ink-700">{errorMessage(error)}</p>
      {onRetry && (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
