import { useState } from 'react'
import { FiActivity, FiCalendar, FiDollarSign, FiStar, FiUserCheck, FiUsers } from 'react-icons/fi'
import { getSpecialityBreakdown, getSummary, getTimeseries, getTopDoctors } from '../../api/admin'
import { listAppointments } from '../../api/appointments'
import Card from '../../components/Card'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import StatusBadge from '../../components/StatusBadge'
import BarChart from '../../components/charts/BarChart'
import DonutChart from '../../components/charts/DonutChart'
import LineChart from '../../components/charts/LineChart'
import Avatar from '../../components/ui/Avatar'
import DataTable from '../../components/ui/DataTable'
import DateRangePicker from '../../components/ui/DateRangePicker'
import StatCard from '../../components/ui/StatCard'
import Tabs from '../../components/ui/Tabs'
import { useFetch } from '../../hooks/useFetch'
import { daysAgoISO, formatDate, formatPeriod, formatTime, todayISO } from '../../lib/date'
import { formatCompact, formatCurrency, formatPercent } from '../../lib/format'

const INTERVALS = [
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
]

const topColumns = [
  {
    key: 'doctor',
    header: 'Doctor',
    render: (r) => (
      <span className="flex items-center gap-2">
        <Avatar name={r.doctor.name} src={r.doctor.image} size="sm" />
        <span>
          {r.doctor.name}
          <span className="block text-xs text-slate-500">{r.doctor.speciality}</span>
        </span>
      </span>
    ),
  },
  { key: 'appointments', header: 'Visits', sortable: true },
  { key: 'revenue', header: 'Revenue', sortable: true, render: (r) => formatCurrency(r.revenue) },
  { key: 'rating', header: 'Rating', sortable: true, render: (r) => (r.rating ? r.rating.toFixed(1) : '-') },
]

const latestColumns = [
  { key: 'patient', header: 'Patient', render: (a) => a.patient.name },
  { key: 'doctor', header: 'Doctor', render: (a) => a.doctor.name },
  { key: 'when', header: 'When', render: (a) => `${formatDate(a.date)} ${formatTime(a.time)}` },
  { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
]

export default function Dashboard() {
  const [range, setRange] = useState({ from: daysAgoISO(29), to: todayISO() })
  const [interval, setGranularity] = useState('day')

  const summary = useFetch(getSummary)
  const series = useFetch(() => getTimeseries({ ...range, interval }), [range.from, range.to, interval], {
    enabled: Boolean(range.from && range.to),
  })
  const specialities = useFetch(getSpecialityBreakdown)
  const top = useFetch(() => getTopDoctors(5))
  const latest = useFetch(() => listAppointments({ limit: 6 }))

  const s = summary.data
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Clinic performance at a glance." />
      {summary.error ? (
        <ErrorState error={summary.error} onRetry={summary.reload} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard loading={summary.loading} icon={FiUserCheck} label="Doctors" value={s?.activeDoctors} hint={s && `${s.doctors} registered`} />
          <StatCard loading={summary.loading} icon={FiUsers} label="Patients" value={s && formatCompact(s.patients)} />
          <StatCard
            loading={summary.loading}
            icon={FiCalendar}
            label="Appointments"
            value={s && formatCompact(s.appointments.total)}
            hint={s && `${s.appointments.booked} booked, ${s.appointments.completed} completed`}
          />
          <StatCard
            loading={summary.loading}
            icon={FiDollarSign}
            label="Revenue"
            value={s && formatCurrency(s.revenue.total)}
            hint={s && `${formatCurrency(s.revenue.last30Days)} in the last 30 days`}
          />
          <StatCard
            loading={summary.loading}
            icon={FiActivity}
            label="Cancellation rate"
            value={s && formatPercent(s.cancellationRate)}
            hint={s && `${s.appointments.cancelled} cancelled, ${s.appointments.noShow} no-shows`}
          />
          <StatCard loading={summary.loading} icon={FiStar} label="Average rating" value={s && (s.averageRating ? s.averageRating.toFixed(1) : '-')} />
        </div>
      )}

      <Card
        title="Appointments and revenue"
        className="mt-6"
        actions={<Tabs label="Interval" tabs={INTERVALS} value={interval} onChange={setGranularity} />}
      >
        <div className="mb-3">
          <DateRangePicker presets {...range} onChange={(r) => setRange({ from: r.from, to: r.to })} />
        </div>
        {series.error ? (
          <ErrorState error={series.error} onRetry={series.reload} />
        ) : series.loading ? (
          <div className="h-56 animate-pulse rounded-lg bg-slate-100" aria-label="Loading chart" />
        ) : (
          <LineChart
            label="Appointments and revenue over time"
            data={series.data ?? []}
            xKey="period"
            xFormat={(p) => formatPeriod(p, interval)}
            series={[
              { key: 'appointments', label: 'Appointments' },
              { key: 'revenue', label: 'Revenue', axis: 'right', axisFormat: formatCompact, format: (v) => formatCurrency(v) },
            ]}
          />
        )}
      </Card>

      <Card title="Outcomes by period" className="mt-6">
        {series.error ? (
          <ErrorState error={series.error} onRetry={series.reload} />
        ) : (
          <BarChart
            label="Appointment outcomes by period"
            stacked
            data={(series.data ?? []).map((p) => ({ ...p, other: p.appointments - p.completed - p.cancelled }))}
            xKey="period"
            xFormat={(p) => formatPeriod(p, interval)}
            series={[
              { key: 'completed', label: 'Completed', color: '#059669' },
              { key: 'cancelled', label: 'Cancelled', color: '#dc2626' },
              { key: 'other', label: 'Booked or no-show', color: '#94a3b8' },
            ]}
          />
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Appointments by speciality">
          {specialities.error ? (
            <ErrorState error={specialities.error} onRetry={specialities.reload} />
          ) : (
            <DonutChart
              label="Appointments by speciality"
              centerLabel="Appointments"
              data={(specialities.data ?? []).map((x) => ({ label: x.specialityName, value: x.appointments }))}
            />
          )}
        </Card>
        <Card title="Top doctors">
          {top.error ? (
            <ErrorState error={top.error} onRetry={top.reload} />
          ) : (
            <DataTable columns={topColumns} rows={top.data ?? []} loading={top.loading} rowKey={(r) => r.doctor.id} skeletonRows={3} empty="No completed visits yet." />
          )}
        </Card>
      </div>

      <Card title="Latest appointments" className="mt-6">
        {latest.error ? (
          <ErrorState error={latest.error} onRetry={latest.reload} />
        ) : (
          <DataTable columns={latestColumns} rows={latest.data?.items ?? []} loading={latest.loading} empty="No appointments yet." />
        )}
      </Card>
    </>
  )
}
