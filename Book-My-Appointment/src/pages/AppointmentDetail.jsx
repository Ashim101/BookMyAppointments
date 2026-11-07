import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiCalendar, FiPrinter } from 'react-icons/fi'
import { getAppointment } from '../api/appointments'
import PrescriptionView from '../components/appointments/PrescriptionView'
import { PaymentBadge, StatusBadge } from '../components/appointments/StatusBadges'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import { PageSpinner } from '../components/ui/Spinner'
import { useQuery } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { BRAND } from '../lib/config'
import { downloadIcs } from '../lib/calendar'
import { formatCurrency, formatDate, formatInstant, formatTime, timezoneLabel } from '../lib/format'

export default function AppointmentDetail() {
  const { id } = useParams()
  const { data: appointment, error, loading, refetch } = useQuery(['appointment', id], () => getAppointment(id))
  usePageTitle('Appointment details')

  if (loading) return <PageSpinner label="Loading appointment" />
  if (error) return <ErrorState error={error} onRetry={error.code === 'NOT_FOUND' ? undefined : refetch} />

  const { doctor, patient, consultation } = appointment

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/my-appointments" className="no-print mb-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <FiArrowLeft aria-hidden="true" /> Back to my appointments
      </Link>

      <div className="print-only mb-4 border-b border-slate-300 pb-3">
        <p className="text-xl font-bold">{BRAND}</p>
        <p className="text-sm">Consultation summary</p>
      </div>

      <article className="card space-y-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={doctor.name} src={doctor.image} size="md" />
            <div>
              <h1 className="text-xl font-bold text-ink-900">{doctor.name}</h1>
              <p className="text-sm text-ink-500">{doctor.specialityName}</p>
            </div>
          </div>
          <div className="no-print flex gap-2">
            <StatusBadge status={appointment.status} />
            <PaymentBadge status={appointment.paymentStatus} />
          </div>
        </header>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-500">Patient</dt>
            <dd className="font-medium">{patient.name}</dd>
          </div>
          <div>
            <dt className="text-ink-500">When</dt>
            <dd className="font-medium">
              {formatDate(appointment.date)}, {formatTime(appointment.time)}
            </dd>
            <dd className="text-xs text-ink-500">{timezoneLabel(appointment.timezone)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Fee</dt>
            <dd className="font-medium">{formatCurrency(appointment.fee, appointment.currency)}</dd>
          </div>
          {consultation && (
            <div>
              <dt className="text-ink-500">Completed</dt>
              <dd className="font-medium">{formatInstant(consultation.completedAt, appointment.timezone)}</dd>
            </div>
          )}
          {appointment.reason && (
            <div className="sm:col-span-2">
              <dt className="text-ink-500">Reason for visit</dt>
              <dd>{appointment.reason}</dd>
            </div>
          )}
        </dl>

        {consultation ? (
          <>
            <PrescriptionView consultation={consultation} />
            <div className="no-print">
              <Button variant="secondary" onClick={() => window.print()}>
                <FiPrinter aria-hidden="true" /> Print or save as PDF
              </Button>
            </div>
          </>
        ) : (
          <EmptyState title="No consultation notes yet" description="Notes and prescriptions appear here once the doctor completes the visit." className="no-print" />
        )}

        {appointment.status === 'booked' && (
          <div className="no-print">
            <Button variant="ghost" onClick={() => downloadIcs(appointment)}>
              <FiCalendar aria-hidden="true" /> Add to calendar
            </Button>
          </div>
        )}
      </article>
    </div>
  )
}
