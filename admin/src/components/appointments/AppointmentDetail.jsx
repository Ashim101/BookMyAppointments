import { formatAddress, formatAgeGender, formatCurrency } from '../../lib/format'
import { formatDate, formatDateTime, formatTime } from '../../lib/date'
import Avatar from '../ui/Avatar'
import StatusBadge from '../StatusBadge'

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right font-medium text-slate-800">{children}</dd>
  </div>
)

const Person = ({ title, person, extra }) => (
  <section aria-label={title} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
    <Avatar name={person.name} src={person.image} />
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <p className="truncate font-medium text-slate-900">{person.name}</p>
      <p className="truncate text-xs text-slate-500">{extra}</p>
    </div>
  </section>
)

/** Read-only appointment summary shared by the admin drawer and the doctor views. */
export default function AppointmentDetail({ appointment: a }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Person title="Patient" person={a.patient} extra={`${formatAgeGender(a.patient)} · ${a.patient.phone || a.patient.email}`} />
        <Person title="Doctor" person={a.doctor} extra={a.doctor.specialityName} />
      </div>

      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
        <Row label="Date">{formatDate(a.date)}</Row>
        <Row label="Time">{formatTime(a.time)} ({a.timezone})</Row>
        <Row label="Status"><StatusBadge status={a.status} /></Row>
        <Row label="Payment"><StatusBadge status={a.paymentStatus} kind="payment" /></Row>
        <Row label="Fee">{formatCurrency(a.fee, a.currency)}</Row>
        <Row label="Location">{formatAddress(a.doctor.address)}</Row>
        <Row label="Booked on">{formatDateTime(a.createdAt)}</Row>
      </dl>

      {a.reason && (
        <section>
          <h3 className="text-sm font-semibold text-slate-900">Reason for visit</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.reason}</p>
        </section>
      )}

      {a.cancellation && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <h3 className="font-semibold text-red-800">Cancelled by {a.cancellation.by}</h3>
          <p className="mt-1 text-red-700">{a.cancellation.reason || 'No reason given.'}</p>
          <p className="mt-1 text-xs text-red-600">{formatDateTime(a.cancellation.at)}</p>
        </section>
      )}

      {a.consultation && (
        <section className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <h3 className="font-semibold text-emerald-900">Consultation ({formatDateTime(a.consultation.completedAt)})</h3>
          {a.consultation.notes && <p className="whitespace-pre-wrap text-emerald-900">{a.consultation.notes}</p>}
          {a.consultation.prescription.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-emerald-900">
              {a.consultation.prescription.map((p, i) => (
                <li key={i}>
                  <strong>{p.medicine}</strong> {p.dosage}, {p.frequency}, {p.durationDays} days
                  {p.instructions && <span className="block text-xs">{p.instructions}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {a.review && (
        <section className="rounded-lg border border-slate-200 p-3 text-sm">
          <h3 className="font-semibold text-slate-900">Review: {a.review.rating} / 5</h3>
          {a.review.comment && <p className="mt-1 text-slate-600">{a.review.comment}</p>}
        </section>
      )}
    </div>
  )
}
