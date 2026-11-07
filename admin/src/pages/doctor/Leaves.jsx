import { useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
import { addLeave, deleteLeave, listLeaves } from '../../api/doctorSelf'
import Card from '../../components/Card'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import { useFetch, useMutation } from '../../hooks/useFetch'
import { formatDate, todayISO } from '../../lib/date'
import { fieldErrors } from '../../lib/errorCodes'

export default function Leaves() {
  const list = useFetch(listLeaves)
  const [form, setForm] = useState({ date: '', reason: '' })
  const [errors, setErrors] = useState({})
  const [conflict, setConflict] = useState(null)
  const [removing, setRemoving] = useState(null)

  const create = useMutation(addLeave, { success: 'Leave added', quiet: (error) => error.code === 'CONFLICT' })
  const remove = useMutation(() => deleteLeave(removing.id), { success: 'Leave removed' })

  const submit = async (event, { cancelAppointments = false } = {}) => {
    event?.preventDefault()
    const found = {}
    if (!form.date) found.date = 'Choose a date'
    else if (form.date < todayISO()) found.date = 'Leave must be today or later'
    if (!form.reason.trim()) found.reason = 'Give a reason'
    setErrors(found)
    if (Object.keys(found).length) return

    const body = { date: form.date, reason: form.reason.trim(), ...(cancelAppointments && { cancelAppointments: true }) }
    const result = await create.run(body)
    if (result.ok) {
      setConflict(null)
      setForm({ date: '', reason: '' })
      list.reload()
    } else if (result.error.code === 'CONFLICT') {
      setConflict(result.error.message)
    } else {
      setErrors(fieldErrors(result.error))
    }
  }

  const confirmRemove = async () => {
    const result = await remove.run()
    if (result.ok) {
      setRemoving(null)
      list.reload()
    }
  }

  const columns = [
    { key: 'date', header: 'Date', sortable: true, render: (l) => formatDate(l.date, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) },
    { key: 'reason', header: 'Reason' },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (l) => (
        <span className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setRemoving(l)} aria-label={`Delete leave on ${l.date}`}>
            <FiTrash2 aria-hidden="true" />
          </Button>
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Leaves" subtitle="Days you are unavailable. Patients cannot book these dates." />
      <Card title="Add a leave day" className="mb-6 max-w-3xl">
        <form onSubmit={submit} noValidate className="grid items-start gap-3 sm:grid-cols-[12rem_1fr_auto]">
          <Input label="Date" type="date" min={todayISO()} value={form.date} error={errors.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label="Reason" value={form.reason} error={errors.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <Button type="submit" className="sm:mt-6" loading={create.pending && !conflict}>
            Add leave
          </Button>
        </form>
      </Card>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <DataTable caption="Upcoming leaves" columns={columns} rows={list.data ?? []} loading={list.loading} empty="No upcoming leaves." />
      )}

      <ConfirmDialog
        open={Boolean(conflict)}
        title="Bookings exist on this day"
        message={`${conflict} Cancel those appointments and take the day off? Patients will be notified with your reason.`}
        confirmLabel="Cancel appointments and add leave"
        loading={create.pending}
        onConfirm={() => submit(null, { cancelAppointments: true })}
        onCancel={() => setConflict(null)}
      />
      <ConfirmDialog
        open={Boolean(removing)}
        title="Remove leave?"
        message={`Patients will be able to book ${removing ? formatDate(removing.date) : ''} again.`}
        confirmLabel="Remove"
        loading={remove.pending}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  )
}
