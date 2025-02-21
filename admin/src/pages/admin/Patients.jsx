import { useState } from 'react'
import { blockPatient, listPatients } from '../../api/admin'
import { listAppointments } from '../../api/appointments'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DataTable from '../../components/ui/DataTable'
import Drawer from '../../components/ui/Drawer'
import Input from '../../components/ui/Input'
import Pagination from '../../components/ui/Pagination'
import Select from '../../components/ui/Select'
import { useFetch, useMutation } from '../../hooks/useFetch'
import { useFilters } from '../../hooks/useFilters'
import { useDebounce } from '../../hooks/useTimers'
import { formatDate, formatTime } from '../../lib/date'
import { formatAgeGender } from '../../lib/format'

const DEFAULTS = { search: '', blocked: '', page: 1 }
const LIMIT = 10

function PatientAppointments({ patient }) {
  const { data, loading, error, reload } = useFetch(() => listAppointments({ patientId: patient.id, limit: 50 }))
  const columns = [
    { key: 'when', header: 'When', render: (a) => `${formatDate(a.date)}, ${formatTime(a.time)}` },
    { key: 'doctor', header: 'Doctor', render: (a) => a.doctor.name },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
  ]
  if (error) return <ErrorState error={error} onRetry={reload} />
  return <DataTable columns={columns} rows={data?.items ?? []} loading={loading} skeletonRows={3} empty="This patient has no appointments." />
}

export default function Patients() {
  const { filters, update, reset, dirty } = useFilters('admin.patients', DEFAULTS)
  const search = useDebounce(filters.search)
  const [viewing, setViewing] = useState(null)
  const [blocking, setBlocking] = useState(null)

  const list = useFetch(() => listPatients({ search, blocked: filters.blocked, page: filters.page, limit: LIMIT }), [
    search, filters.blocked, filters.page,
  ])
  const toggle = useMutation((p) => blockPatient(p.id, !p.blocked), {
    success: (p) => (p.blocked ? 'Patient blocked' : 'Patient unblocked'),
  })

  const confirm = async () => {
    const result = await toggle.run(blocking)
    if (result.ok) {
      setBlocking(null)
      list.reload()
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Patient',
      render: (p) => (
        <span className="flex items-center gap-3">
          <Avatar name={p.name} src={p.image} />
          <span>
            <span className="block font-medium text-slate-900">{p.name}</span>
            <span className="block text-xs text-slate-500">{p.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'phone', header: 'Phone', render: (p) => p.phone || '-' },
    { key: 'profile', header: 'Age, gender', render: formatAgeGender },
    { key: 'appointmentsCount', header: 'Appointments', sortable: true },
    { key: 'blocked', header: 'Status', render: (p) => <Badge tone={p.blocked ? 'danger' : 'success'}>{p.blocked ? 'Blocked' : 'Active'}</Badge> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (p) => (
        <span className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setViewing(p)} aria-label={`View appointments of ${p.name}`}>
            Appointments
          </Button>
          <Button variant={p.blocked ? 'secondary' : 'danger'} size="sm" onClick={() => setBlocking(p)}>
            {p.blocked ? 'Unblock' : 'Block'}
          </Button>
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Patients" subtitle="Registered patients and their account status." />
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-3">
        <Input label="Search by name or email" type="search" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
        <Select
          label="Account status"
          placeholder="All patients"
          value={filters.blocked}
          onChange={(e) => update({ blocked: e.target.value })}
          options={[{ value: 'true', label: 'Blocked only' }, { value: 'false', label: 'Not blocked' }]}
        />
        <Button variant="ghost" onClick={reset} disabled={!dirty}>
          Clear filters
        </Button>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <>
          <DataTable caption="Patients" columns={columns} rows={list.data?.items ?? []} loading={list.loading} empty="No patients match these filters." />
          {list.data && <Pagination {...list.data} onChange={(page) => update({ page })} />}
        </>
      )}

      <Drawer open={Boolean(viewing)} onClose={() => setViewing(null)} title={`Appointments: ${viewing?.name ?? ''}`} width="max-w-xl">
        {viewing && <PatientAppointments patient={viewing} />}
      </Drawer>

      <ConfirmDialog
        open={Boolean(blocking)}
        title={blocking?.blocked ? 'Unblock patient?' : 'Block patient?'}
        message={
          blocking?.blocked
            ? `${blocking?.name} will be able to sign in and book again.`
            : `${blocking?.name} will be signed out and unable to book until unblocked.`
        }
        confirmLabel={blocking?.blocked ? 'Unblock' : 'Block'}
        tone={blocking?.blocked ? 'primary' : 'danger'}
        loading={toggle.pending}
        onConfirm={confirm}
        onCancel={() => setBlocking(null)}
      />
    </>
  )
}
