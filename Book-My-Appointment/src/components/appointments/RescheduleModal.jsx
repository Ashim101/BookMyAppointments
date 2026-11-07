import { useState } from 'react'
import { toast } from 'react-toastify'
import { rescheduleAppointment } from '../../api/appointments'
import { useAction } from '../../hooks/useQuery'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatTime } from '../../lib/format'
import SlotPicker from '../doctors/SlotPicker'
import Button from '../ui/Button'
import Modal from '../ui/Modal'

const MAX_RESCHEDULES = 2
const SLOT_ERRORS = ['SLOT_TAKEN', 'SLOT_UNAVAILABLE']

export default function RescheduleModal({ appointment, open, onClose, onRescheduled }) {
  const [selected, setSelected] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState('')
  const reschedule = useAction(rescheduleAppointment)

  const submit = async () => {
    setNotice('')
    try {
      const updated = await reschedule.run(appointment.id, selected)
      toast.success('Your appointment has been rescheduled.')
      onRescheduled(updated)
    } catch (err) {
      if (SLOT_ERRORS.includes(err.code)) {
        setNotice(`${errorMessage(err)} We have refreshed the available times.`)
        setSelected(null)
        setRefreshKey((k) => k + 1)
      } else {
        toast.error(errorMessage(err))
        if (err.code === 'CANCELLATION_WINDOW_PASSED' || err.code === 'INVALID_STATE') onClose()
      }
    }
  }

  if (!appointment) return null
  const remaining = MAX_RESCHEDULES - appointment.rescheduleCount

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Reschedule appointment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={reschedule.loading}>
            Close
          </Button>
          <Button onClick={submit} disabled={!selected} loading={reschedule.loading}>
            {selected ? `Move to ${formatDate(selected.date, { weekday: false })}, ${formatTime(selected.time)}` : 'Choose a new time'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-700">
          Currently with {appointment.doctor.name} on {formatDate(appointment.date)} at {formatTime(appointment.time)}. You can
          reschedule {remaining > 0 ? `${remaining} more ${remaining === 1 ? 'time' : 'times'}` : 'no more times'}.
        </p>
        {notice && (
          <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {notice}
          </p>
        )}
        <SlotPicker doctorId={appointment.doctor.id} selected={selected} onSelect={setSelected} refreshKey={refreshKey} />
      </div>
    </Modal>
  )
}
