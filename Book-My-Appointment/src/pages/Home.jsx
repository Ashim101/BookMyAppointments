import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { FiCalendar, FiCheckCircle, FiSearch } from 'react-icons/fi'
import { listDoctors } from '../api/doctors'
import { listSpecialities } from '../api/specialities'
import DoctorCard, { DoctorCardSkeleton } from '../components/doctors/DoctorCard'
import HeroIllustration from '../components/illustrations/HeroIllustration'
import SpecialityIcon from '../components/illustrations/SpecialityIcon'
import { ButtonLink } from '../components/ui/Button'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Skeleton from '../components/ui/Skeleton'
import { selectIsAuthenticated } from '../features/auth/authSlice'
import { useQuery } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'

const STEPS = [
  { icon: FiSearch, title: 'Find', text: 'Search by name or speciality and compare fees, experience and ratings.' },
  { icon: FiCalendar, title: 'Book', text: 'Pick a real, open time slot. No phone calls and no waiting on hold.' },
  { icon: FiCheckCircle, title: 'Visit', text: 'Pay online, get reminders and find your notes and prescription afterwards.' },
]

function Specialities() {
  const { data, error, loading, refetch } = useQuery(['specialities'], listSpecialities)
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, n) => (
          <Skeleton key={n} className="h-28" />
        ))}
      </div>
    )
  }
  if (data.length === 0) return <EmptyState title="No specialities yet" description="Check back soon." />
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {data.map((speciality) => (
        <li key={speciality.id}>
          <Link
            to={`/doctors?speciality=${encodeURIComponent(speciality.slug)}`}
            className="card flex h-full flex-col items-center gap-2 p-4 text-center transition-shadow hover:shadow-lg"
          >
            <span className="rounded-full bg-brand-50 p-3 text-brand-700">
              <SpecialityIcon slug={speciality.slug} />
            </span>
            <span className="text-sm font-semibold text-ink-900">{speciality.name}</span>
            <span className="text-xs text-ink-500">
              {speciality.doctorCount} {speciality.doctorCount === 1 ? 'doctor' : 'doctors'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function TopDoctors() {
  const { data, error, loading, refetch } = useQuery(['top-doctors'], () => listDoctors({ sort: 'rating', limit: 8 }))
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, n) => (
          <DoctorCardSkeleton key={n} />
        ))}
      </div>
    )
  }
  if (data.items.length === 0) return <EmptyState title="No doctors listed yet" description="Doctors appear here once they join." />
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data.items.map((doctor) => (
        <DoctorCard key={doctor.id} doctor={doctor} />
      ))}
    </div>
  )
}

export default function Home() {
  usePageTitle()
  const authenticated = useSelector(selectIsAuthenticated)

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 rounded-3xl bg-brand-50 px-6 py-10 md:grid-cols-2 md:px-12">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight text-ink-900 sm:text-4xl lg:text-5xl">
            Care that fits <span className="text-brand-600">your calendar</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-ink-700">
            Find a doctor you trust, see when they are free and book in under a minute. Reschedule or cancel whenever plans change.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/doctors" size="lg">
              Find a doctor
            </ButtonLink>
            {!authenticated && (
              <ButtonLink to="/register" size="lg" variant="secondary">
                Create free account
              </ButtonLink>
            )}
          </div>
        </div>
        <HeroIllustration className="mx-auto w-full max-w-md" />
      </section>

      <section aria-labelledby="specialities-heading">
        <h2 id="specialities-heading" className="text-2xl font-bold text-ink-900">
          Browse by speciality
        </h2>
        <p className="mb-6 mt-1 text-ink-500">Choose the kind of care you are looking for.</p>
        <Specialities />
      </section>

      <section aria-labelledby="top-heading">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 id="top-heading" className="text-2xl font-bold text-ink-900">
              Top-rated doctors
            </h2>
            <p className="mt-1 text-ink-500">Highly rated by patients after their visits.</p>
          </div>
          <Link to="/doctors?sort=rating" className="text-sm font-semibold text-brand-700 hover:underline">
            See all
          </Link>
        </div>
        <TopDoctors />
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="mb-6 text-2xl font-bold text-ink-900">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Icon aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold">
                {index + 1}. {title}
              </h3>
              <p className="mt-1 text-sm text-ink-500">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl bg-brand-700 px-6 py-10 text-center text-white md:px-12">
        <h2 className="text-2xl font-bold sm:text-3xl">Ready for your next appointment?</h2>
        <p className="mx-auto mt-2 max-w-xl text-brand-100">Create an account to book, pay and keep every visit, note and prescription in one place.</p>
        <ButtonLink to={authenticated ? '/doctors' : '/register'} size="lg" variant="secondary" className="mt-6">
          {authenticated ? 'Book an appointment' : 'Get started'}
        </ButtonLink>
      </section>
    </div>
  )
}
