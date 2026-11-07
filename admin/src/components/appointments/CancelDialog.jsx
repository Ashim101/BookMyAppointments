import { useState } from 'react'
import { cancelAppointment } from '../../api/appointments'
import { useMutation } from '../../hooks/useFetch'
import { formatDate, formatTime } from '../../lib/date'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Textarea from '../ui/Textarea'

/** Asks for a cancellation reason, then cancels. Calls `onCancelled(updatedAppointment)` on success. */
export default function CancelDialog({ appointment, onClose, onCancelled }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const cancel = useMutation((text) => cancelAppointment(appointment.id, text), { success: 'Appointment cancelled' })

  const submit = async (event) => {
    event.preventDefault()
    if (reason.trim().length < 3) {
      setError('Please give a reason of at least 3 characters')
      return
    }
    const result = await cancel.run(reason.trim())
    if (result.ok) onCancelled(result.data)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Cancel appointment"
      description={`${appointment.patient.name}, ${formatDate(appointment.date)} at ${formatTime(appointment.time)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep appointment
          </Button>
          <Button type="submit" form="cancel-form" variant="danger" loading={cancel.pending}>
            Cancel appointment
          </Button>
        </>
      }
    >
      <form id="cancel-form" onSubmit={submit} noValidate>
        <Textarea
          label="Reason (shared with the patient)"
          required
          value={reason}
          error={error}
          onChange={(e) => {
            setReason(e.target.value)
            setError('')
          }}
          data-autofocus
        />
      </form>
    </Modal>
  )
}
