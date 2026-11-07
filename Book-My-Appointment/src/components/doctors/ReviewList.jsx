import { useState } from 'react'
import { getReviews } from '../../api/doctors'
import { useQuery } from '../../hooks/useQuery'
import { formatDate } from '../../lib/format'
import Avatar from '../ui/Avatar'
import EmptyState, { ErrorState } from '../ui/EmptyState'
import Pagination from '../ui/Pagination'
import Skeleton from '../ui/Skeleton'
import { StarsDisplay } from '../ui/StarRating'

const PAGE_SIZE = 5

export default function ReviewList({ doctorId }) {
  const [page, setPage] = useState(1)
  const { data, error, loading, refetch } = useQuery(['reviews', doctorId, page], () =>
    getReviews(doctorId, { page, limit: PAGE_SIZE }),
  )

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1].map((n) => (
          <Skeleton key={n} className="h-20 w-full" />
        ))}
      </div>
    )
  }
  if (data.items.length === 0) {
    return <EmptyState title="No reviews yet" description="Reviews from patients appear here after their visits." />
  }

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {data.items.map((review) => (
          <li key={review.id} className="flex gap-3 py-4">
            <Avatar name={review.patient.name} src={review.patient.image} size="sm" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-ink-900">{review.patient.name}</span>
                <StarsDisplay value={review.rating} size={14} />
                <time className="text-xs text-ink-500" dateTime={review.createdAt}>
                  {formatDate(review.createdAt.slice(0, 10), { weekday: false })}
                </time>
              </div>
              {review.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{review.comment}</p>}
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
    </div>
  )
}
