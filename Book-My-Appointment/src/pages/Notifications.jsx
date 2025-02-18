import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { FiBell } from 'react-icons/fi'
import { toast } from 'react-toastify'
import { listNotifications } from '../api/notifications'
import NotificationItem from '../components/notifications/NotificationItem'
import Button from '../components/ui/Button'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import Skeleton from '../components/ui/Skeleton'
import Tabs from '../components/ui/Tabs'
import { readAll, readOne } from '../features/notifications/notificationsSlice'
import { useQuery } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { errorMessage } from '../lib/errors'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
]

export default function Notifications() {
  usePageTitle('Notifications')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { data, error, loading, refetch } = useQuery(['notifications', filter, page], () =>
    listNotifications({ page, limit: 10, ...(filter === 'unread' ? { unread: 'true' } : {}) }),
  )

  const openItem = async (notification) => {
    if (!notification.read) {
      const result = await dispatch(readOne(notification.id))
      if (result.error) return toast.error(errorMessage(result.error))
      refetch()
    }
    if (notification.link?.startsWith('/')) navigate(notification.link)
  }

  const markAll = async () => {
    const result = await dispatch(readAll())
    if (result.error) toast.error(errorMessage(result.error))
    else refetch()
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink-900">Notifications</h1>
        <Button variant="secondary" size="sm" onClick={markAll} disabled={!data?.unreadCount}>
          Mark all as read
        </Button>
      </div>
      <Tabs
        tabs={TABS}
        active={filter}
        onChange={(id) => {
          setFilter(id)
          setPage(1)
        }}
        label="Notification filter"
      >
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : loading && !data ? (
          <Skeleton className="h-64 w-full" />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={<FiBell size={36} />}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="Booking updates, reminders and prescriptions will appear here."
          />
        ) : (
          <>
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {data.items.map((n) => (
                <NotificationItem key={n.id} notification={n} onOpen={openItem} />
              ))}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
          </>
        )}
      </Tabs>
    </div>
  )
}
