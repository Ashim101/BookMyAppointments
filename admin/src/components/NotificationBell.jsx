import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBell } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { listNotifications, markAllRead, markRead } from '../api/notifications'
import { useFetch } from '../hooks/useFetch'
import { usePolling } from '../hooks/useTimers'
import { formatDateTime } from '../lib/date'
import { messageFor } from '../lib/errorCodes'
import EmptyState from './EmptyState'

export const POLL_INTERVAL_MS = 60_000

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const navigate = useNavigate()
  const { data, reload, setData } = useFetch(() => listNotifications({ limit: 8 }))
  usePolling(reload, POLL_INTERVAL_MS)

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e) => !root.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = data?.unreadCount ?? 0
  const items = data?.items ?? []

  const openItem = async (item) => {
    try {
      if (!item.read) {
        await markRead(item.id)
        setData((d) => ({
          ...d,
          unreadCount: Math.max(0, d.unreadCount - 1),
          items: d.items.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
        }))
      }
      setOpen(false)
      if (item.link?.startsWith('/')) navigate(item.link)
    } catch (error) {
      toast.error(messageFor(error))
    }
  }

  const readAll = async () => {
    try {
      await markAllRead()
      setData((d) => ({ ...d, unreadCount: 0, items: d.items.map((n) => ({ ...n, read: true })) }))
    } catch (error) {
      toast.error(messageFor(error))
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
      >
        <FiBell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
            <button type="button" onClick={readAll} disabled={!unread} className="text-xs font-medium text-brand-700 disabled:text-slate-400">
              Mark all as read
            </button>
          </div>
          {items.length === 0 ? (
            <EmptyState message="You are all caught up." />
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/60'}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {!n.read && <span className="h-2 w-2 rounded-full bg-brand-600" aria-label="Unread" />}
                      {n.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-600">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
