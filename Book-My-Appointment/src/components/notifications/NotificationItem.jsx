import { FiBell } from 'react-icons/fi'
import { formatRelativeTime } from '../../lib/format'
import { cx } from '../ui/cx'

export default function NotificationItem({ notification, onOpen }) {
  const { title, message, read, createdAt } = notification
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cx('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', !read && 'bg-brand-50/60')}
    >
      <span className={cx('mt-0.5 rounded-full p-2', read ? 'bg-slate-100 text-ink-500' : 'bg-brand-100 text-brand-700')}>
        <FiBell size={14} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cx('text-sm text-ink-900', !read && 'font-semibold')}>{title}</span>
          {!read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
        </span>
        <span className="mt-0.5 block text-sm text-ink-700">{message}</span>
        <span className="mt-1 block text-xs text-ink-500">{formatRelativeTime(createdAt)}</span>
      </span>
    </button>
  )
}
