import { useState } from 'react'
import { FiStar, FiTrash2 } from 'react-icons/fi'
import { deleteReview, listReviews } from '../../api/admin'
import { listDoctors } from '../../api/doctors'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DataTable from '../../components/ui/DataTable'
import Pagination from '../../components/ui/Pagination'
import Select from '../../components/ui/Select'
import { useFetch, useMutation } from '../../hooks/useFetch'
import { useFilters } from '../../hooks/useFilters'
import { formatDate } from '../../lib/date'

const DEFAULTS = { doctorId: '', maxRating: '', page: 1 }
const LIMIT = 10
const RATING_OPTIONS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} star${n > 1 ? 's' : ''} or fewer` }))

function Stars({ value }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500" role="img" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <FiStar key={i} className={i < value ? 'fill-current' : 'text-slate-300'} aria-hidden="true" />
      ))}
    </span>
  )
}

export default function Reviews() {
  const { filters, update, reset, dirty } = useFilters('admin.reviews', DEFAULTS)
  const [removing, setRemoving] = useState(null)
  const doctors = useFetch(() => listDoctors({ limit: 100 }))
  const list = useFetch(() => listReviews({ ...filters, limit: LIMIT }), [filters.doctorId, filters.maxRating, filters.page])
  const remove = useMutation(() => deleteReview(removing.id), { success: 'Review deleted' })

  const confirm = async () => {
    const result = await remove.run()
    if (result.ok) {
      setRemoving(null)
      list.reload()
    }
  }

  const columns = [
    {
      key: 'patient',
      header: 'Patient',
      render: (r) => (
        <span className="flex items-center gap-2">
          <Avatar name={r.patient.name} src={r.patient.image} size="sm" />
          {r.patient.name}
        </span>
      ),
    },
    { key: 'doctor', header: 'Doctor', render: (r) => r.doctor.name },
    { key: 'rating', header: 'Rating', sortable: true, render: (r) => <Stars value={r.rating} /> },
    { key: 'comment', header: 'Comment', className: 'max-w-sm', render: (r) => <p className="line-clamp-3">{r.comment || '-'}</p> },
    { key: 'createdAt', header: 'Date', render: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setRemoving(r)} aria-label={`Delete review by ${r.patient.name}`}>
          <FiTrash2 aria-hidden="true" />
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Reviews" subtitle="Moderate patient feedback. Deleting a review recalculates the doctor's rating." />
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-3">
        <Select
          label="Doctor"
          placeholder="All doctors"
          value={filters.doctorId}
          onChange={(e) => update({ doctorId: e.target.value })}
          options={(doctors.data?.items ?? []).map((d) => ({ value: d.id, label: d.name }))}
        />
        <Select label="Maximum rating" placeholder="Any rating" value={filters.maxRating} onChange={(e) => update({ maxRating: e.target.value })} options={RATING_OPTIONS} />
        <Button variant="ghost" onClick={reset} disabled={!dirty}>
          Clear filters
        </Button>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <>
          <DataTable caption="Reviews" columns={columns} rows={list.data?.items ?? []} loading={list.loading} empty="No reviews match these filters." />
          {list.data && <Pagination {...list.data} onChange={(page) => update({ page })} />}
        </>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete review?"
        message={`The ${removing?.rating}-star review for ${removing?.doctor.name} will be removed permanently.`}
        confirmLabel="Delete"
        loading={remove.pending}
        onConfirm={confirm}
        onCancel={() => setRemoving(null)}
      />
    </>
  )
}
