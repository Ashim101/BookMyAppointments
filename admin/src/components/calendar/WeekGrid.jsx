import { positionAppointment, unavailableBlocks } from '../../lib/calendar'
import { formatDate, formatTime, toISODate } from '../../lib/date'

export const PX_PER_HOUR = 56

const STATUS_STYLE = {
  booked: 'border-sky-500 bg-sky-100 text-sky-900',
  completed: 'border-emerald-500 bg-emerald-100 text-emerald-900',
  no_show: 'border-amber-500 bg-amber-100 text-amber-900',
}

/**
 * Seven day columns against an hourly time axis. Appointment blocks are placed
 * by start time and duration; non-working time is shaded and leave days are marked.
 */
export default function WeekGrid({ dates, appointmentsByDate, schedule, leaves, bounds, onSelect, now = new Date() }) {
  const { startHour, endHour } = bounds
  const view = { startHour, endHour, pxPerHour: PX_PER_HOUR }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
  const height = (endHour - startHour) * PX_PER_HOUR
  const leaveByDate = new Map(leaves.map((l) => [l.date, l]))
  const today = toISODate(now)
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60 - startHour) * PX_PER_HOUR
  const showNow = nowTop >= 0 && nowTop <= height

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid min-w-[56rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
        <div className="border-b border-slate-200" />
        {dates.map((date) => {
          const leave = leaveByDate.get(date)
          return (
            <div key={date} className={`border-b border-l border-slate-200 px-2 py-2 text-center ${date === today ? 'bg-brand-50' : ''}`}>
              <p className="text-xs font-semibold uppercase text-slate-500">{formatDate(date, { weekday: 'short' })}</p>
              <p className={`text-sm font-semibold ${date === today ? 'text-brand-700' : 'text-slate-900'}`}>{formatDate(date, { day: 'numeric', month: 'short' })}</p>
              {leave && <p className="mt-0.5 truncate text-[11px] font-medium text-amber-700">On leave</p>}
            </div>
          )
        })}

        <div className="relative" style={{ height }} aria-hidden="true">
          {hours.map((h, i) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-slate-400" style={{ top: i * PX_PER_HOUR }}>
              {i > 0 && formatTime(`${String(h).padStart(2, '0')}:00`)}
            </span>
          ))}
        </div>
        {dates.map((date) => {
          const leave = leaveByDate.get(date)
          return (
            <div key={date} data-testid={`day-${date}`} className="relative border-l border-slate-200" style={{ height }}>
              {hours.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * PX_PER_HOUR }} />
              ))}
              {unavailableBlocks(date, schedule, view).map((b, i) => (
                <div key={i} data-testid="unavailable" className="absolute inset-x-0 bg-slate-100/90" style={b} />
              ))}
              {date === today && showNow && (
                <div
                  data-testid="now-indicator"
                  aria-hidden="true"
                  className="absolute inset-x-0 z-10 border-t-2 border-red-500"
                  style={{ top: nowTop }}
                />
              )}
              {leave && (
                <div data-testid="leave" title={leave.reason} className="absolute inset-0 bg-amber-100/70" />
              )}
              {(appointmentsByDate[date] ?? []).map((a) => {
                const pos = positionAppointment(a, view)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelect(a)}
                    style={{ top: pos.top, height: pos.height }}
                    aria-label={`${formatTime(a.time)} ${a.patient.name}, ${a.status.replace('_', ' ')}`}
                    className={`absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm hover:brightness-95 ${STATUS_STYLE[a.status]}`}
                  >
                    <span className="block font-semibold">{formatTime(a.time)}</span>
                    <span className="block truncate">{a.patient.name}</span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
