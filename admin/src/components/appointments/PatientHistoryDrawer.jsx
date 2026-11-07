import { patientHistory } from '../../api/doctorSelf'
import { useFetch } from '../../hooks/useFetch'
import { formatDate, formatTime } from '../../lib/date'
import { formatAgeGender } from '../../lib/format'
import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import StatusBadge from '../StatusBadge'
import Avatar from '../ui/Avatar'
import Drawer from '../ui/Drawer'

function History({ patient }) {
  const { data, loading, error, reload } = useFetch(() => patientHistory(patient.id))
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading) return <div className="h-32 animate-pulse rounded-lg bg-slate-100" aria-label="Loading history" />
  if (!data.length) return <EmptyState message="No earlier visits with you." />

  return (
    <ol className="space-y-3">
      {data.map((a) => (
        <li key={a.id} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-slate-900">
              {formatDate(a.date)}, {formatTime(a.time)}
            </p>
            <StatusBadge status={a.status} />
          </div>
          {a.reason && <p className="mt-1 text-slate-600">Reason: {a.reason}</p>}
          {a.consultation?.notes && <p className="mt-2 whitespace-pre-wrap text-slate-700">{a.consultation.notes}</p>}
          {a.consultation?.prescription.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-slate-700">
              {a.consultation.prescription.map((p, i) => (
                <li key={i}>
                  {p.medicine} {p.dosage}, {p.frequency}, {p.durationDays} days
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

export default function PatientHistoryDrawer({ patient, onClose }) {
  return (
    <Drawer open={Boolean(patient)} onClose={onClose} title="Patient history">
      {patient && (
        <>
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={patient.name} src={patient.image} size="lg" />
            <div>
              <p className="font-semibold text-slate-900">{patient.name}</p>
              <p className="text-sm text-slate-500">{formatAgeGender(patient)}</p>
            </div>
          </div>
          <History patient={patient} />
        </>
      )}
    </Drawer>
  )
}
