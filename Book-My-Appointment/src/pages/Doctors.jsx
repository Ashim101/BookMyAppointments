import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import { listDoctors } from '../api/doctors'
import { listSpecialities } from '../api/specialities'
import DoctorCard, { DoctorCardSkeleton } from '../components/doctors/DoctorCard'
import DoctorFilters from '../components/doctors/DoctorFilters'
import Button from '../components/ui/Button'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import { useQuery } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { useRecentSearches } from '../hooks/useRecentSearches'
import { readQuery, toApiParams } from '../lib/doctorQuery'

export default function Doctors() {
  usePageTitle('Find doctors')
  const [params, setParams] = useSearchParams()
  const recent = useRecentSearches()
  const query = readQuery(params)
  const specialities = useQuery(['specialities'], listSpecialities)
  const doctors = useQuery(['doctors', query], () => listDoctors(toApiParams(query)))

  const update = useCallback(
    (patch) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(patch)) {
            if (value === '' || value == null || value === false) next.delete(key)
            else next.set(key, String(value))
          }
          if (!('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const total = doctors.data?.total
  const clear = () => setParams({}, { replace: true })

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <aside className="lg:col-span-1">
        <DoctorFilters
          query={query}
          specialities={specialities.data ?? []}
          recent={recent.items}
          onChange={update}
          onClear={clear}
          onSearchCommitted={recent.remember}
          onClearRecent={recent.clear}
        />
      </aside>

      <section className="lg:col-span-3" aria-labelledby="results-heading">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h1 id="results-heading" className="text-2xl font-bold text-ink-900">
            Find a doctor
          </h1>
          <p className="text-sm text-ink-500" aria-live="polite">
            {total != null && `${total} ${total === 1 ? 'doctor' : 'doctors'} found`}
          </p>
        </div>

        {doctors.error ? (
          <ErrorState error={doctors.error} onRetry={doctors.refetch} />
        ) : doctors.loading && !doctors.data ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, n) => (
              <DoctorCardSkeleton key={n} />
            ))}
          </div>
        ) : doctors.data.items.length === 0 ? (
          <EmptyState
            icon={<FiSearch size={36} />}
            title="No doctors match your search"
            description="Try a different name, widen the fee range or clear the filters."
            action={
              <Button variant="secondary" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className={doctors.loading ? 'opacity-60 transition-opacity' : ''}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {doctors.data.items.map((doctor) => (
                <DoctorCard key={doctor.id} doctor={doctor} />
              ))}
            </div>
            <Pagination page={doctors.data.page} totalPages={doctors.data.totalPages} onChange={(page) => update({ page })} />
          </div>
        )}
      </section>
    </div>
  )
}
