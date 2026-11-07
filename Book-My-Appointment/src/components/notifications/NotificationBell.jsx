import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { FiBell } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { readAll, readOne } from '../../features/notifications/notificationsSlice'
import { useDismiss } from '../../hooks/useDismiss'
import { errorMessage } from '../../lib/errors'
import NotificationItem from './NotificationItem'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const { items, unreadCount, loaded } = useSelector((state) => state.notifications)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const ref = useDismiss(open, () => setOpen(false))

  const openItem = async (notification) => {
    setOpen(false)
    if (!notification.read) dispatch(readOne(notification.id))
    if (notification.link?.startsWith('/')) navigate(notification.link)
  }

  const markAll = async () => {
    const result = await dispatch(readAll())
    if (result.error) toast.error(errorMessage(result.error))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative rounded-full p-2 text-ink-700 hover:bg-slate-100"
      >
        <FiBell size={20} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <button
              type="button"
              onClick={markAll}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-brand-700 hover:underline disabled:text-ink-300 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {items.map((n) => (
              <NotificationItem key={n.id} notification={n} onOpen={openItem} />
            ))}
            {loaded && items.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-500">You are all caught up.</p>}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-200 px-4 py-3 text-center text-sm font-semibold text-brand-700 hover:bg-slate-50">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
