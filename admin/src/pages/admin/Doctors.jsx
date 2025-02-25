import { useState } from 'react'
import { FiClock, FiEdit2, FiPlus } from 'react-icons/fi'
import { listSpecialities } from '../../api/admin'
import { listDoctors, saveDoctorSchedule, setDoctorActive, setDoctorAvailability } from '../../api/doctors'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import ScheduleEditor from '../../components/schedule/ScheduleEditor'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DataTable from '../../components/ui/DataTable'
import Drawer from '../../components/ui/Drawer'
import Input from '../../components/ui/Input'
import Pagination from '../../components/ui/Pagination'
import Select from '../../components/ui/Select'
import Toggle from '../../components/ui/Toggle'
import { useFetch, useMutation } from '../../hooks/useFetch'
import { useFilters } from '../../hooks/useFilters'
import { useDebounce } from '../../hooks/useTimers'
import { formatCurrency } from '../../lib/format'
import DoctorDetail from './DoctorDetail'
import DoctorForm from './DoctorForm'

const DEFAULTS = { search: '', speciality: '', active: '', page: 1 }
const LIMIT = 10

export default function Doctors() {
  const { filters, update, reset, dirty } = useFilters('admin.doctors', DEFAULTS)
  const search = useDebounce(filters.search)
  const [form, setForm] = useState(null)
  const [scheduleFor, setScheduleFor] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [toggleActive, setToggleActive] = useState(null)

  const specialities = useFetch(listSpecialities)
  const doctors = useFetch(
    () => listDoctors({ search, speciality: filters.speciality, active: filters.active, page: filters.page, limit: LIMIT }),
    [search, filters.speciality, filters.active, filters.page],
  )

  const availability = useMutation((d) => setDoctorAvailability(d.id, !d.available))
  const activation = useMutation((d) => setDoctorActive(d.id, !d.active), {
    success: (d) => (d.active ? 'Doctor activated' : 'Doctor deactivated'),
  })
  const schedule = useMutation((s) => saveDoctorSchedule(scheduleFor.id, s), { success: 'Schedule saved' })

  const flipAvailability = async (doctor) => {
    const result = await availability.run(doctor)
    if (result.ok) doctors.reload()
  }

  const confirmActive = async () => {
    const result = await activation.run(toggleActive)
    if (result.ok) {
      setToggleActive(null)
      doctors.reload()
    }
  }

  const saveSchedule = async (value) => {
    const result = await schedule.run(value)
    if (result.ok) {
      setScheduleFor(null)
      doctors.reload()
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Doctor',
      render: (d) => (
        <span className="flex items-center gap-3">
          <Avatar name={d.name} src={d.image} />
          <span>
            <button type="button" onClick={() => setViewing(d)} className="block font-medium text-brand-700 hover:underline">
              {d.name}
            </button>
            <span className="block text-xs text-slate-500">{d.email}</span>
          </span>
        </span>
      ),
    },
    { key: 'specialityName', header: 'Speciality' },
    { key: 'fees', header: 'Fees', sortable: true, render: (d) => formatCurrency(d.fees, d.currency) },
    { key: 'rating', header: 'Rating', sortable: true, sortValue: (d) => d.rating.average, render: (d) => (d.rating.count ? `${d.rating.average} (${d.rating.count})` : '-') },
    {
      key: 'available',
      header: 'Accepting bookings',
      render: (d) => <Toggle checked={d.available} onChange={() => flipAvailability(d)} label={`${d.name} accepting bookings`} disabled={!d.active} />,
    },
    { key: 'active', header: 'Status', render: (d) => <Badge tone={d.active ? 'success' : 'neutral'}>{d.active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (d) => (
        <span className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setForm({ doctor: d })} aria-label={`Edit ${d.name}`}>
            <FiEdit2 aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setScheduleFor(d)} aria-label={`Edit schedule for ${d.name}`}>
            <FiClock aria-hidden="true" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setToggleActive(d)}>
            {d.active ? 'Deactivate' : 'Activate'}
          </Button>
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Doctors"
        subtitle="Manage who can take bookings."
        actions={
          <Button onClick={() => setForm({ doctor: null })}>
            <FiPlus aria-hidden="true" /> Add doctor
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Input label="Search by name" type="search" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
        <Select
          label="Speciality"
          placeholder="All specialities"
          value={filters.speciality}
          onChange={(e) => update({ speciality: e.target.value })}
          options={(specialities.data ?? []).map((s) => ({ value: s.slug, label: s.name }))}
        />
        <Select
          label="Status"
          placeholder="Active and inactive"
          value={filters.active}
          onChange={(e) => update({ active: e.target.value })}
          options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]}
        />
        <div className="flex items-end">
          <Button variant="ghost" onClick={reset} disabled={!dirty}>
            Clear filters
          </Button>
        </div>
      </div>

      {doctors.error ? (
        <ErrorState error={doctors.error} onRetry={doctors.reload} />
      ) : (
        <>
          <DataTable caption="Doctors" columns={columns} rows={doctors.data?.items ?? []} loading={doctors.loading} empty="No doctors match these filters." />
          {doctors.data && <Pagination {...doctors.data} onChange={(page) => update({ page })} />}
        </>
      )}

      {form && (
        <DoctorForm
          key={form.doctor?.id ?? 'new'}
          open
          doctor={form.doctor}
          specialities={specialities.data ?? []}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            doctors.reload()
          }}
        />
      )}

      <DoctorDetail doctor={viewing} onClose={() => setViewing(null)} />

      <Drawer open={Boolean(scheduleFor)} onClose={() => setScheduleFor(null)} title={`Schedule: ${scheduleFor?.name ?? ''}`} width="max-w-2xl">
        {scheduleFor && <ScheduleEditor schedule={scheduleFor.schedule} onSave={saveSchedule} saving={schedule.pending} />}
      </Drawer>

      <ConfirmDialog
        open={Boolean(toggleActive)}
        title={toggleActive?.active ? 'Deactivate doctor?' : 'Activate doctor?'}
        message={
          toggleActive?.active
            ? `${toggleActive.name} will be hidden from public listings and unable to sign in. Existing appointments are kept.`
            : `${toggleActive?.name} will be visible again and can sign in.`
        }
        confirmLabel={toggleActive?.active ? 'Deactivate' : 'Activate'}
        tone={toggleActive?.active ? 'danger' : 'primary'}
        loading={activation.pending}
        onConfirm={confirmActive}
        onCancel={() => setToggleActive(null)}
      />
    </>
  )
}
