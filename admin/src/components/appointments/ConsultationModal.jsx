import { useState } from 'react'
import { completeAppointment } from '../../api/appointments'
import { useMutation } from '../../hooks/useFetch'
import { formatDate, formatTime } from '../../lib/date'
import { hasRowErrors, toPrescription, validateRows } from '../../lib/prescription'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Textarea from '../ui/Textarea'
import PrescriptionBuilder from './PrescriptionBuilder'

const NOTES_MAX = 5000

/** Completes an appointment with consultation notes and an optional prescription. */
export default function ConsultationModal({ appointment, onClose, onCompleted }) {
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState([])
  const [rowErrors, setRowErrors] = useState([])
  const [notesError, setNotesError] = useState('')
  const complete = useMutation((body) => completeAppointment(appointment.id, body), { success: 'Appointment completed' })

  const submit = async (event) => {
    event.preventDefault()
    const errors = validateRows(rows)
    setRowErrors(errors)
    const tooLong = notes.length > NOTES_MAX
    setNotesError(tooLong ? `Notes can be at most ${NOTES_MAX} characters` : '')
    if (hasRowErrors(errors) || tooLong) return
    const result = await complete.run({ notes: notes.trim(), prescription: toPrescription(rows) })
    if (result.ok) onCompleted(result.data)
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Complete consultation"
      description={`${appointment.patient.name}, ${formatDate(appointment.date)} at ${formatTime(appointment.time)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="consultation-form" loading={complete.pending}>
            Complete appointment
          </Button>
        </>
      }
    >
      <form id="consultation-form" onSubmit={submit} noValidate className="space-y-5">
        <Textarea label="Consultation notes" rows={5} value={notes} error={notesError} onChange={(e) => setNotes(e.target.value)} />
        <PrescriptionBuilder rows={rows} errors={rowErrors} onChange={setRows} />
      </form>
    </Modal>
  )
}
