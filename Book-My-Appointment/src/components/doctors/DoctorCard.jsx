import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/format'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import { RatingDisplay } from '../ui/StarRating'
import Skeleton from '../ui/Skeleton'

export default function DoctorCard({ doctor, actions }) {
  return (
    <article className="card relative flex flex-col p-5 transition-shadow hover:shadow-lg">
      <div className="flex items-start gap-4">
        <Avatar name={doctor.name} src={doctor.image} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink-900">
            <Link to={`/doctors/${doctor.id}`} className="rounded after:absolute after:inset-0 hover:text-brand-700">
              {doctor.name}
            </Link>
          </h3>
          <p className="text-sm text-ink-500">{doctor.specialityName}</p>
          <RatingDisplay average={doctor.rating.average} count={doctor.rating.count} className="mt-1" />
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-ink-500">Experience</dt>
          <dd className="font-medium">{doctor.experienceYears} yrs</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Fee</dt>
          <dd className="font-medium">{formatCurrency(doctor.fees, doctor.currency)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between">
        {doctor.available ? <Badge tone="success">Accepting bookings</Badge> : <Badge>Unavailable</Badge>}
        <span className="relative z-10">{actions}</span>
      </div>
    </article>
  )
}

export function DoctorCardSkeleton() {
  return (
    <div className="card space-y-4 p-5" aria-hidden="true">
      <div className="flex gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  )
}
