import { useState } from 'react'
import { listAppointments } from '../../api/appointments'
import AppointmentActions from '../../components/appointments/AppointmentActions'
import AppointmentDetail from '../../components/appointments/AppointmentDetail'
import PatientHistoryDrawer from '../../components/appointments/PatientHistoryDrawer'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import DateRangePicker from '../../components/ui/DateRangePicker'
import Drawer from '../../components/ui/Drawer'
import Pagination from '../../components/ui/Pagination'
import Select from '../../components/ui/Select'
import { useFetch } from '../../hooks/useFetch'
import { useFilters } from '../../hooks/useFilters'
import { formatDate, formatTime } from '../../lib/date'
import { formatAgeGender } from '../../lib/format'
import { statusOptions } from '../../lib/status'

const DEFAULTS = { status: '', scope: '', from: '', to: '', page: 1 }
const LIMIT = 10

export default function Appointments() {
  const { filters, update, reset, dirty } = useFilters('doctor.appointments', DEFAULTS)
  const [selected, setSelected] = useState(null)
  const [historyOf, setHistoryOf] = useState(null)
  const list = useFetch(() => listAppointments({ ...filters, limit: LIMIT }), [JSON.stringify(filters)])

  const updated = (appointment) => {
    setSelected((s) => (s ? appointment : s))
    list.reload()
  }

  const columns = [
    {
      key: 'patient',
      header: 'Patient',
      render: (a) => (
        <span className="flex items-center gap-3">
          <Avatar name={a.patient.name} src={a.patient.image} size="sm" />
          <span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setHistoryOf(a.patient)
              }}
              className="font-medium text-brand-700 hover:underline"
            >
              {a.patient.name}
            </button>
            <span className="block text-xs text-slate-500">{formatAgeGender(a.patient)}</span>
          </span>
        </span>
      ),
    },
    { key: 'when', header: 'When', sortable: true, sortValue: (a) => a.startsAt, render: (a) => `${formatDate(a.date)}, ${formatTime(a.time)}` },
    { key: 'reason', header: 'Reason', className: 'max-w-xs', render: (a) => <p className="truncate">{a.reason || '-'}</p> },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    { key: 'actions', header: <span className="sr-only">Actions</span>, render: (a) => <AppointmentActions appointment={a} onUpdated={updated} /> },
  ]

  return (
    <>
      <PageHeader title="Appointments" subtitle="Your bookings. Available actions depend on the appointment's state." />
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Status" placeholder="All statuses" value={filters.status} onChange={(e) => update({ status: e.target.value })} options={statusOptions} />
        <Select
          label="Timing"
          placeholder="Any time"
          value={filters.scope}
          onChange={(e) => update({ scope: e.target.value })}
          options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]}
        />
        <Button variant="ghost" onClick={reset} disabled={!dirty}>
          Clear filters
        </Button>
        <div className="sm:col-span-2 lg:col-span-4">
          <DateRangePicker from={filters.from} to={filters.to} onChange={(r) => update({ from: r.from, to: r.to })} />
        </div>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <>
          <DataTable caption="Appointments" columns={columns} rows={list.data?.items ?? []} loading={list.loading} onRowClick={setSelected} empty="No appointments match these filters." />
          {list.data && <Pagination {...list.data} onChange={(page) => update({ page })} />}
        </>
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Appointment details"
        footer={selected && <AppointmentActions appointment={selected} onUpdated={updated} size="md" />}
      >
        {selected && <AppointmentDetail appointment={selected} />}
      </Drawer>
      <PatientHistoryDrawer patient={historyOf} onClose={() => setHistoryOf(null)} />
    </>
  )
}
