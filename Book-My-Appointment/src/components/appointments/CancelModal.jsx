import { useState } from 'react'
import { toast } from 'react-toastify'
import { cancelAppointment } from '../../api/appointments'
import { useAction } from '../../hooks/useQuery'
import { CANCELLATION_CUTOFF_HOURS } from '../../lib/config'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatInstant, formatTime, shiftHours } from '../../lib/format'
import { validateReason } from '../../lib/validation'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Textarea from '../ui/Textarea'

export default function CancelModal({ appointment, open, onClose, onCancelled }) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const cancel = useAction(cancelAppointment)
  const error = validateReason(reason, { required: true })

  const submit = async (event) => {
    event.preventDefault()
    setTouched(true)
    if (error) return
    try {
      const updated = await cancel.run(appointment.id, reason.trim())
      toast.success('Your appointment has been cancelled.')
      onCancelled(updated)
    } catch (err) {
      toast.error(errorMessage(err))
      if (err.code === 'CANCELLATION_WINDOW_PASSED' || err.code === 'INVALID_STATE') onClose()
    }
  }

  if (!appointment) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel appointment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={cancel.loading}>
            Keep appointment
          </Button>
          <Button type="submit" form="cancel-form" variant="danger" loading={cancel.loading}>
            Cancel appointment
          </Button>
        </>
      }
    >
      <form id="cancel-form" onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-ink-700">
          {appointment.doctor.name} on {formatDate(appointment.date)} at {formatTime(appointment.time)}.
        </p>
        <p className="rounded-lg bg-slate-50 p-3 text-sm text-ink-700">
          <strong>Cancellation policy:</strong> you can cancel or reschedule up to {CANCELLATION_CUTOFF_HOURS} hours before the
          appointment, which is until {formatInstant(shiftHours(appointment.startsAt, -CANCELLATION_CUTOFF_HOURS), appointment.timezone)}. After that, please contact the
          clinic.
          {appointment.paymentStatus === 'paid' && ' Because you have paid, a refund will be started automatically.'}
        </p>
        <Textarea
          data-autofocus
          label="Reason for cancelling"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          error={touched ? error : ''}
        />
      </form>
    </Modal>
  )
}
