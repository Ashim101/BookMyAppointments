import { useEffect, useMemo, useState } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { listAppointments } from '../../api/appointments'
import { getSchedule, listLeaves } from '../../api/doctorSelf'
import AppointmentActions from '../../components/appointments/AppointmentActions'
import AppointmentDetail from '../../components/appointments/AppointmentDetail'
import PatientHistoryDrawer from '../../components/appointments/PatientHistoryDrawer'
import WeekGrid from '../../components/calendar/WeekGrid'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import Drawer from '../../components/ui/Drawer'
import { useFetch } from '../../hooks/useFetch'
import { calendarBounds, groupByDate } from '../../lib/calendar'
import { addDays, formatDate, startOfWeek, timeToMinutes, todayISO, weekDates } from '../../lib/date'

const isTyping = (target) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable

export default function Calendar() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()))
  const [selected, setSelected] = useState(null)
  const [historyOf, setHistoryOf] = useState(null)
  const dates = useMemo(() => weekDates(weekStart), [weekStart])

  const schedule = useFetch(getSchedule)
  const leaves = useFetch(listLeaves)
  const week = useFetch(() => listAppointments({ from: dates[0], to: dates[6], limit: 100 }), [weekStart])

  const visible = useMemo(() => (week.data?.items ?? []).filter((a) => a.status !== 'cancelled'), [week.data])
  const bounds = useMemo(() => {
    const base = calendarBounds(schedule.data)
    const starts = visible.map((a) => Math.floor(timeToMinutes(a.time) / 60))
    const ends = visible.map((a) => Math.ceil((timeToMinutes(a.time) + 30) / 60))
    return { startHour: Math.min(base.startHour, ...starts), endHour: Math.min(24, Math.max(base.endHour, ...ends)) }
  }, [schedule.data, visible])

  useEffect(() => {
    const onKey = (event) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey || selected || historyOf) return
      if (event.key === 'ArrowLeft') setWeekStart((w) => addDays(w, -7))
      else if (event.key === 'ArrowRight') setWeekStart((w) => addDays(w, 7))
      else if (event.key.toLowerCase() === 't') setWeekStart(startOfWeek(todayISO()))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, historyOf])

  const updated = (appointment) => {
    setSelected(appointment)
    week.reload()
  }

  const error = schedule.error ?? week.error
  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={`${formatDate(dates[0], { day: 'numeric', month: 'short' })} to ${formatDate(dates[6])}. Arrow keys change week, T jumps to today.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
              <FiChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(todayISO()))}>
              Today
            </Button>
            <Button variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
              <FiChevronRight aria-hidden="true" />
            </Button>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => { schedule.reload(); week.reload() }} />
      ) : schedule.loading || !schedule.data ? (
        <div className="h-96 animate-pulse rounded-xl bg-slate-100" aria-label="Loading calendar" />
      ) : (
        <WeekGrid
          dates={dates}
          appointmentsByDate={groupByDate(visible)}
          schedule={schedule.data}
          leaves={leaves.data ?? []}
          bounds={bounds}
          onSelect={setSelected}
        />
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Appointment details"
        footer={
          selected && (
            <>
              <Button variant="secondary" onClick={() => setHistoryOf(selected.patient)}>
                Patient history
              </Button>
              <AppointmentActions appointment={selected} onUpdated={updated} size="md" />
            </>
          )
        }
      >
        {selected && <AppointmentDetail appointment={selected} />}
      </Drawer>
      <PatientHistoryDrawer patient={historyOf} onClose={() => setHistoryOf(null)} />
    </>
  )
}
