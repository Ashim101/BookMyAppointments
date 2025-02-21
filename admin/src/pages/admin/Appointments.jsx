import { useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import { exportAppointments, listAppointments } from '../../api/appointments'
import { listDoctors } from '../../api/doctors'
import AppointmentDetail from '../../components/appointments/AppointmentDetail'
import CancelDialog from '../../components/appointments/CancelDialog'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import Button from '../../components/ui/Button'
import DataTable from '../../components/ui/DataTable'
import DateRangePicker from '../../components/ui/DateRangePicker'
import Drawer from '../../components/ui/Drawer'
import Pagination from '../../components/ui/Pagination'
import Select from '../../components/ui/Select'
import { useFetch, useMutation } from '../../hooks/useFetch'
import { useFilters } from '../../hooks/useFilters'
import { formatDate, formatTime } from '../../lib/date'
import { formatCurrency } from '../../lib/format'
import { statusOptions } from '../../lib/status'

const DEFAULTS = { status: '', doctorId: '', scope: '', from: '', to: '', page: 1 }
const LIMIT = 10
const SCOPES = [{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]

const columns = [
  { key: 'patient', header: 'Patient', render: (a) => a.patient.name },
  { key: 'doctor', header: 'Doctor', render: (a) => a.doctor.name },
  { key: 'when', header: 'When', sortable: true, sortValue: (a) => a.startsAt, render: (a) => `${formatDate(a.date)}, ${formatTime(a.time)}` },
  { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
  { key: 'payment', header: 'Payment', render: (a) => <StatusBadge status={a.paymentStatus} kind="payment" /> },
  { key: 'fee', header: 'Fee', sortable: true, render: (a) => formatCurrency(a.fee, a.currency) },
]

export default function Appointments() {
  const { filters, update, reset, dirty } = useFilters('admin.appointments', DEFAULTS)
  const [selected, setSelected] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  const { page, ...query } = filters
  const doctors = useFetch(() => listDoctors({ limit: 100 }))
  const list = useFetch(() => listAppointments({ ...query, page, limit: LIMIT }), [JSON.stringify(filters)])
  const exporter = useMutation(() => exportAppointments(query), { success: (name) => `Exported ${name}` })

  const afterCancel = (updated) => {
    setCancelling(null)
    setSelected(updated)
    list.reload()
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Every booking across the clinic."
        actions={
          <Button variant="secondary" onClick={() => exporter.run()} loading={exporter.pending}>
            <FiDownload aria-hidden="true" /> Export CSV
          </Button>
        }
      />
      <div className="mb-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select label="Status" placeholder="All statuses" value={filters.status} onChange={(e) => update({ status: e.target.value })} options={statusOptions} />
        <Select
          label="Doctor"
          placeholder="All doctors"
          value={filters.doctorId}
          onChange={(e) => update({ doctorId: e.target.value })}
          options={(doctors.data?.items ?? []).map((d) => ({ value: d.id, label: d.name }))}
        />
        <Select label="Timing" placeholder="Any time" value={filters.scope} onChange={(e) => update({ scope: e.target.value })} options={SCOPES} />
        <Button variant="ghost" onClick={reset} disabled={!dirty}>
          Clear filters
        </Button>
        <div className="sm:col-span-2">
          <DateRangePicker from={filters.from} to={filters.to} onChange={(r) => update({ from: r.from, to: r.to })} />
        </div>
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <>
          <DataTable caption="Appointments" columns={columns} rows={list.data?.items ?? []} loading={list.loading} onRowClick={setSelected} empty="No appointments match these filters." />
          {list.data && <Pagination {...list.data} onChange={(p) => update({ page: p })} />}
        </>
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Appointment details"
        footer={
          selected?.actions.canCancel && (
            <Button variant="danger" onClick={() => setCancelling(selected)}>
              Cancel appointment
            </Button>
          )
        }
      >
        {selected && <AppointmentDetail appointment={selected} />}
      </Drawer>
      {cancelling && <CancelDialog appointment={cancelling} onClose={() => setCancelling(null)} onCancelled={afterCancel} />}
    </>
  )
}
