import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiCalendar } from 'react-icons/fi'
import { listAppointments } from '../api/appointments'
import AppointmentCard from '../components/appointments/AppointmentCard'
import CancelModal from '../components/appointments/CancelModal'
import RescheduleModal from '../components/appointments/RescheduleModal'
import ReviewModal from '../components/appointments/ReviewModal'
import { ButtonLink } from '../components/ui/Button'
import EmptyState, { ErrorState } from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import Skeleton from '../components/ui/Skeleton'
import Tabs from '../components/ui/Tabs'
import { usePayment } from '../features/payments/usePayment'
import { useQuery } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
]
const FILTERS = { upcoming: { scope: 'upcoming' }, past: { scope: 'past' }, cancelled: { status: 'cancelled' } }
const EMPTY = {
  upcoming: 'You have no upcoming appointments.',
  past: 'Completed and missed visits will show up here.',
  cancelled: 'You have not cancelled any appointments.',
}

export default function MyAppointments() {
  usePageTitle('My appointments')
  const [params, setParams] = useSearchParams()
  const tab = FILTERS[params.get('tab')] ? params.get('tab') : 'upcoming'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [dialog, setDialog] = useState({ type: null, appointment: null })

  const { data, error, loading, refetch } = useQuery(['my-appointments', tab, page], () =>
    listAppointments({ ...FILTERS[tab], page, limit: 6 }),
  )
  const payment = usePayment({ onPaid: refetch })

  const close = () => setDialog({ type: null, appointment: null })
  const done = () => {
    close()
    refetch()
  }
  const open = (type) => (appointment) => setDialog({ type, appointment })
  const go = (next) => setParams(next, { replace: true })

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-ink-900">My appointments</h1>
      <Tabs tabs={TABS} active={tab} onChange={(id) => go({ tab: id })} label="Appointment lists">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : loading && !data ? (
          <div className="space-y-4" aria-busy="true">
            {[0, 1, 2].map((n) => (
              <Skeleton key={n} className="h-44 w-full" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={<FiCalendar size={36} />}
            title="Nothing here yet"
            description={EMPTY[tab]}
            action={
              tab === 'upcoming' && (
                <ButtonLink to="/doctors">Find a doctor</ButtonLink>
              )
            }
          />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <div className="space-y-4">
              {data.items.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  busy={payment.busyId === appointment.id}
                  onPay={payment.pay}
                  onCancel={open('cancel')}
                  onReschedule={open('reschedule')}
                  onReview={open('review')}
                />
              ))}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onChange={(next) => go({ tab, page: next })} />
          </div>
        )}
      </Tabs>

      <CancelModal appointment={dialog.appointment} open={dialog.type === 'cancel'} onClose={close} onCancelled={done} />
      <RescheduleModal appointment={dialog.appointment} open={dialog.type === 'reschedule'} onClose={close} onRescheduled={done} />
      <ReviewModal appointment={dialog.appointment} open={dialog.type === 'review'} onClose={close} onReviewed={done} />
      {payment.dialog}
    </div>
  )
}
