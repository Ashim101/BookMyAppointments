import { useState } from 'react'
import { markNoShow } from '../../api/appointments'
import { useMutation } from '../../hooks/useFetch'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import CancelDialog from './CancelDialog'
import ConsultationModal from './ConsultationModal'

/**
 * Doctor actions for one appointment. Which buttons exist is decided only by
 * `appointment.actions`; the client never re-derives rules from dates or status.
 */
export default function AppointmentActions({ appointment, onUpdated, size = 'sm' }) {
  const [dialog, setDialog] = useState(null)
  const noShow = useMutation(() => markNoShow(appointment.id), { success: 'Marked as no-show' })
  const { canComplete, canCancel, canMarkNoShow } = appointment.actions

  const done = (updated) => {
    setDialog(null)
    onUpdated(updated)
  }

  const confirmNoShow = async () => {
    const result = await noShow.run()
    if (result.ok) done(result.data)
  }

  if (!canComplete && !canCancel && !canMarkNoShow) return null
  return (
    <span className="inline-flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
      {canComplete && (
        <Button size={size} onClick={() => setDialog('complete')}>
          Complete
        </Button>
      )}
      {canMarkNoShow && (
        <Button size={size} variant="secondary" onClick={() => setDialog('noshow')}>
          No-show
        </Button>
      )}
      {canCancel && (
        <Button size={size} variant="danger" onClick={() => setDialog('cancel')}>
          Cancel
        </Button>
      )}
      {dialog === 'complete' && <ConsultationModal appointment={appointment} onClose={() => setDialog(null)} onCompleted={done} />}
      {dialog === 'cancel' && <CancelDialog appointment={appointment} onClose={() => setDialog(null)} onCancelled={done} />}
      <ConfirmDialog
        open={dialog === 'noshow'}
        title="Mark as no-show?"
        message={`${appointment.patient.name} did not attend. This cannot be undone.`}
        confirmLabel="Mark no-show"
        loading={noShow.pending}
        onConfirm={confirmNoShow}
        onCancel={() => setDialog(null)}
      />
    </span>
  )
}
