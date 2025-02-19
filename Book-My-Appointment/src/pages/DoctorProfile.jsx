import { Link, useParams } from 'react-router-dom'
import { FiBriefcase, FiMapPin } from 'react-icons/fi'
import { getDoctor } from '../api/doctors'
import BookingPanel from '../components/doctors/BookingPanel'
import ReviewList from '../components/doctors/ReviewList'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import { ErrorState } from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { RatingDisplay } from '../components/ui/StarRating'
import { useQuery } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { formatCurrency } from '../lib/format'

export default function DoctorProfile() {
  const { id } = useParams()
  const { data: doctor, error, loading, refetch } = useQuery(['doctor', id], () => getDoctor(id))
  usePageTitle(doctor?.name)

  if (loading) return <PageSpinner label="Loading doctor" />
  if (error) {
    return (
      <div className="space-y-4">
        <ErrorState error={error} onRetry={error.code === 'NOT_FOUND' ? undefined : refetch} />
        <Link to="/doctors" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
          Browse all doctors
        </Link>
      </div>
    )
  }

  const address = [doctor.address.line1, doctor.address.line2, doctor.address.city].filter(Boolean).join(', ')

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-2">
        <section className="card p-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
            <Avatar name={doctor.name} src={doctor.image} size="xl" />
            <div className="mt-4 sm:ml-5 sm:mt-0">
              <h1 className="text-2xl font-bold text-ink-900">{doctor.name}</h1>
              <p className="text-ink-500">{doctor.degree}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Badge tone="info">{doctor.specialityName}</Badge>
                {doctor.available ? <Badge tone="success">Accepting bookings</Badge> : <Badge>Unavailable</Badge>}
              </div>
              <RatingDisplay average={doctor.rating.average} count={doctor.rating.count} className="mt-2" />
            </div>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <FiBriefcase className="text-brand-600" aria-hidden="true" />
              <dt className="sr-only">Experience</dt>
              <dd>{doctor.experienceYears} years of experience</dd>
            </div>
            {address && (
              <div className="flex items-center gap-2">
                <FiMapPin className="text-brand-600" aria-hidden="true" />
                <dt className="sr-only">Address</dt>
                <dd>{address}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
              <dt className="text-ink-500">Consultation fee</dt>
              <dd className="text-lg font-bold text-ink-900">{formatCurrency(doctor.fees, doctor.currency)}</dd>
            </div>
          </dl>
        </section>

        <section className="card p-6" aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-lg font-semibold">
            About
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-700">{doctor.about || 'This doctor has not added a biography yet.'}</p>
        </section>
      </div>

      <div className="space-y-6 lg:col-span-3">
        <section className="card p-6" aria-labelledby="book-heading">
          <h2 id="book-heading" className="mb-4 text-lg font-semibold">
            Book an appointment
          </h2>
          <BookingPanel doctor={doctor} />
        </section>
        <section className="card p-6" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-lg font-semibold">
            Patient reviews
          </h2>
          <ReviewList doctorId={doctor.id} />
        </section>
      </div>
    </div>
  )
}
