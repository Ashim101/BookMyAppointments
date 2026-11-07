import { FiAlertTriangle } from 'react-icons/fi'
import { messageFor } from '../lib/errorCodes'
import Button from './ui/Button'

export default function ErrorState({ error, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center">
      <FiAlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
      <p className="text-sm text-red-800">{messageFor(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
