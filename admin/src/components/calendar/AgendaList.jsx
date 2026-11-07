import { formatDate, formatTime } from '../../lib/date'
import StatusBadge from '../StatusBadge'

/** Day-by-day list of the week's appointments; easier to read than the grid on narrow screens. */
export default function AgendaList({ dates, appointmentsByDate, leaves, onSelect }) {
  const leaveByDate = new Map(leaves.map((l) => [l.date, l]))
  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const items = [...(appointmentsByDate[date] ?? [])].sort((a, b) => a.time.localeCompare(b.time))
        const leave = leaveByDate.get(date)
        return (
          <section key={date} aria-label={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center justify-between text-sm font-semibold text-slate-900">
              {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
              {leave && <span className="text-xs font-medium text-amber-700">On leave: {leave.reason}</span>}
            </h2>
            {items.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No appointments.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100">
                {items.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => onSelect(a)} className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-slate-50">
                      <span className="text-sm">
                        <span className="font-semibold text-slate-900">{formatTime(a.time)}</span> {a.patient.name}
                        <span className="block text-xs text-slate-500">{a.reason || 'No reason given'}</span>
                      </span>
                      <StatusBadge status={a.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
