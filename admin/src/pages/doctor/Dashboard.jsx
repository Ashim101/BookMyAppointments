import { useState } from 'react'
import { FiCalendar, FiCheckCircle, FiDollarSign, FiPrinter, FiStar, FiUsers } from 'react-icons/fi'
import { listAppointments } from '../../api/appointments'
import { getDashboard } from '../../api/doctorSelf'
import AppointmentActions from '../../components/appointments/AppointmentActions'
import PatientHistoryDrawer from '../../components/appointments/PatientHistoryDrawer'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import BarChart from '../../components/charts/BarChart'
import Button from '../../components/ui/Button'
import StatCard from '../../components/ui/StatCard'
import { useFetch } from '../../hooks/useFetch'
import { formatDate, formatPeriod, formatTime, todayISO } from '../../lib/date'
import { formatCompact, formatCurrency } from '../../lib/format'

function QueueItem({ appointment, onOpenPatient, onUpdated }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {formatTime(appointment.time)}{' '}
          <button type="button" onClick={() => onOpenPatient(appointment.patient)} className="font-medium text-brand-700 hover:underline">
            {appointment.patient.name}
          </button>
        </p>
        <p className="text-xs text-slate-500">{appointment.reason || 'No reason given'}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={appointment.status} />
        <span className="no-print">
          <AppointmentActions appointment={appointment} onUpdated={onUpdated} />
        </span>
      </div>
    </li>
  )
}

export default function Dashboard() {
  const [patient, setPatient] = useState(null)
  const today = todayISO()
  const summary = useFetch(getDashboard)
  const queue = useFetch(() => listAppointments({ from: today, to: today, limit: 50 }), [today])

  const refresh = () => {
    summary.reload()
    queue.reload()
  }
  const todays = [...(queue.data?.items ?? [])].filter((a) => a.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time))
  const d = summary.data

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Today is ${formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}.`} />
      <div className="no-print">
        {summary.error ? (
          <ErrorState error={summary.error} onRetry={summary.reload} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard loading={summary.loading} icon={FiDollarSign} label="Earnings" value={d && formatCurrency(d.earnings.total)} hint={d && `${formatCurrency(d.earnings.thisMonth)} this month`} />
            <StatCard loading={summary.loading} icon={FiCalendar} label="Today" value={d?.appointments.today} hint={d && `${d.appointments.upcoming} upcoming`} />
            <StatCard loading={summary.loading} icon={FiUsers} label="Patients" value={d && formatCompact(d.patients)} />
            <StatCard loading={summary.loading} icon={FiCheckCircle} label="Completed" value={d?.appointments.completed} hint={d && `${d.appointments.cancelled} cancelled, ${d.appointments.noShow} no-shows`} />
            <StatCard loading={summary.loading} icon={FiStar} label="Rating" value={d && (d.rating.count ? d.rating.average.toFixed(1) : '-')} hint={d && `${d.rating.count} reviews`} />
          </div>
        )}

        <Card title="Earnings, last 6 months" className="mt-6">
          {d && (
            <BarChart
              label="Monthly earnings"
              data={d.earningsSeries}
              xKey="period"
              xFormat={(p) => formatPeriod(p, 'month')}
              series={[{ key: 'amount', label: 'Earnings' }]}
              valueFormat={(v) => formatCurrency(v)}
              axisFormat={formatCompact}
            />
          )}
        </Card>
      </div>

      <Card
        title={`Today's queue (${formatDate(today)})`}
        className="mt-6"
        actions={
          <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
            <FiPrinter aria-hidden="true" /> Print schedule
          </Button>
        }
      >
        {queue.error ? (
          <ErrorState error={queue.error} onRetry={queue.reload} />
        ) : queue.loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-slate-100" aria-label="Loading queue" />
        ) : todays.length === 0 ? (
          <EmptyState message="No appointments today." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {todays.map((a) => (
              <QueueItem key={a.id} appointment={a} onOpenPatient={setPatient} onUpdated={refresh} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Next appointments" className="no-print mt-6">
        {summary.loading ? null : !d?.next.length ? (
          <EmptyState message="Nothing upcoming." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.next.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{a.patient.name}</span>
                  <span className="block text-xs text-slate-500">
                    {formatDate(a.date)}, {formatTime(a.time)}
                  </span>
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <PatientHistoryDrawer patient={patient} onClose={() => setPatient(null)} />
    </>
  )
}
