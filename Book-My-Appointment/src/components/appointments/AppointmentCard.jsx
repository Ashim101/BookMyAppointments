import { Link } from 'react-router-dom'
import { FiCalendar, FiClock } from 'react-icons/fi'
import { downloadIcs } from '../../lib/calendar'
import { formatCurrency, formatDate, formatTime } from '../../lib/format'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import { StarsDisplay } from '../ui/StarRating'
import { PaymentBadge, StatusBadge } from './StatusBadges'

/** Every action button is gated strictly by `appointment.actions`. */
export default function AppointmentCard({ appointment, busy = false, onPay, onCancel, onReschedule, onReview }) {
  const { doctor, actions, status, consultation, review, cancellation } = appointment

  return (
    <article className="card p-5" aria-label={`Appointment with ${doctor.name} on ${appointment.date}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={doctor.name} src={doctor.image} />
          <div>
            <h3 className="font-semibold text-ink-900">
              <Link to={`/doctors/${doctor.id}`} className="hover:text-brand-700">
                {doctor.name}
              </Link>
            </h3>
            <p className="text-sm text-ink-500">{doctor.specialityName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={status} />
          <PaymentBadge status={appointment.paymentStatus} />
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <FiCalendar className="text-brand-600" aria-hidden="true" />
          <div>
            <dt className="sr-only">Date</dt>
            <dd>{formatDate(appointment.date)}</dd>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FiClock className="text-brand-600" aria-hidden="true" />
          <div>
            <dt className="sr-only">Time</dt>
            <dd>{formatTime(appointment.time)}</dd>
          </div>
        </div>
        <div>
          <dt className="inline text-ink-500">Fee: </dt>
          <dd className="inline font-medium">{formatCurrency(appointment.fee, appointment.currency)}</dd>
        </div>
      </dl>

      {appointment.reason && <p className="mt-3 text-sm text-ink-700">Reason: {appointment.reason}</p>}
      {cancellation && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          Cancelled by {cancellation.by}
          {cancellation.reason ? `: ${cancellation.reason}` : '.'}
        </p>
      )}
      {review && (
        <div className="mt-3 flex items-center gap-2 text-sm text-ink-700">
          <StarsDisplay value={review.rating} /> {review.comment}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {actions.canPay && (
          <Button size="sm" onClick={() => onPay(appointment)} loading={busy}>
            Pay now
          </Button>
        )}
        {actions.canReschedule && (
          <Button size="sm" variant="secondary" onClick={() => onReschedule(appointment)}>
            Reschedule
          </Button>
        )}
        {actions.canCancel && (
          <Button size="sm" variant="secondary" onClick={() => onCancel(appointment)}>
            Cancel
          </Button>
        )}
        {actions.canReview && (
          <Button size="sm" variant="secondary" onClick={() => onReview(appointment)}>
            Leave a review
          </Button>
        )}
        {status === 'booked' && (
          <Button size="sm" variant="ghost" onClick={() => downloadIcs(appointment)}>
            Add to calendar
          </Button>
        )}
        {consultation && (
          <Link
            to={`/my-appointments/${appointment.id}`}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            View notes and prescription
          </Link>
        )}
      </div>
    </article>
  )
}
