import { useEffect, useState } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getSlots } from '../../api/doctors'
import { usePublicSettings } from '../../hooks/usePublicSettings'
import { useQuery } from '../../hooks/useQuery'
import { addDays, formatDayOfMonth, formatTime, formatWeekday, timezoneLabel } from '../../lib/format'
import { cx } from '../ui/cx'
import { ErrorState } from '../ui/EmptyState'
import Skeleton from '../ui/Skeleton'

const freeCount = (day) => day.slots.filter((s) => s.available).length

/**
 * Week-at-a-time slot chooser. `selected` is `{ date, time }` or null; `refreshKey` forces a refetch
 * (used after SLOT_TAKEN / SLOT_UNAVAILABLE).
 */
export default function SlotPicker({ doctorId, selected, onSelect, refreshKey = 0 }) {
  const [offset, setOffset] = useState(0)
  const [anchor, setAnchor] = useState(null)
  const [activeDate, setActiveDate] = useState(selected?.date ?? null)
  const settings = usePublicSettings()
  const from = offset > 0 ? addDays(anchor, offset * 7) : undefined

  const { data, error, loading, refetch } = useQuery(['slots', doctorId, from, refreshKey], () =>
    getSlots(doctorId, { from, days: 7 }),
  )

  useEffect(() => {
    if (!data) return
    setAnchor((current) => current ?? data.days[0]?.date ?? null)
    setActiveDate((current) => {
      const stillThere = data.days.find((d) => d.date === current && freeCount(d) > 0)
      return stillThere ? current : (data.days.find((d) => freeCount(d) > 0)?.date ?? null)
    })
  }, [data])

  if (error) return <ErrorState error={error} onRetry={refetch} />

  const days = data?.days ?? []
  const activeDay = days.find((d) => d.date === activeDate)
  const weekIsEmpty = days.length > 0 && days.every((d) => freeCount(d) === 0)
  // The first week starts today (clinic time), and bookings are allowed up to bookingWindowDays from then.
  const windowEnd = settings && anchor ? addDays(anchor, settings.bookingWindowDays) : null
  const nextWeekStart = anchor ? addDays(anchor, (offset + 1) * 7) : null
  const beyondWindow = windowEnd !== null && nextWeekStart > windowEnd

  return (
    <section aria-label="Choose a time" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          disabled={offset === 0 || loading}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-700 hover:bg-slate-100 disabled:text-ink-300 disabled:hover:bg-transparent"
        >
          <FiChevronLeft aria-hidden="true" /> Previous week
        </button>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          disabled={loading || beyondWindow || (weekIsEmpty && offset > 0)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-700 hover:bg-slate-100 disabled:text-ink-300 disabled:hover:bg-transparent"
        >
          Next week <FiChevronRight aria-hidden="true" />
        </button>
      </div>

      {loading && !data ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div role="group" aria-label="Day" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {days.map((day) => {
              const free = freeCount(day)
              const active = day.date === activeDate
              return (
                <button
                  key={day.date}
                  type="button"
                  disabled={free === 0}
                  aria-pressed={active}
                  onClick={() => setActiveDate(day.date)}
                  className={cx(
                    'rounded-xl border px-2 py-2 text-center text-sm transition-colors',
                    active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white hover:border-brand-400',
                    free === 0 && 'cursor-not-allowed bg-slate-50 text-ink-300 hover:border-slate-200',
                  )}
                >
                  <span className="block text-xs font-medium uppercase">{formatWeekday(day.date)}</span>
                  <span className="block font-semibold">{formatDayOfMonth(day.date)}</span>
                  <span className="block text-[11px]">{free === 0 ? 'Full' : `${free} free`}</span>
                </button>
              )
            })}
          </div>

          {weekIsEmpty && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No times are open this week. {beyondWindow ? 'This is the end of the booking window.' : offset > 0 ? 'Go back, or the booking window may end here.' : 'Try the next week.'}
            </p>
          )}

          {activeDay && (
            <div role="group" aria-label={`Times on ${activeDay.date}`} className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {activeDay.slots.map((slot) => {
                const isSelected = selected?.date === activeDay.date && selected?.time === slot.time
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    aria-pressed={isSelected}
                    onClick={() => onSelect({ date: activeDay.date, time: slot.time })}
                    className={cx(
                      'rounded-lg border px-2 py-2 text-sm font-medium transition-colors',
                      isSelected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white hover:border-brand-400',
                      !slot.available && 'cursor-not-allowed bg-slate-50 text-ink-300 line-through hover:border-slate-200',
                    )}
                  >
                    {formatTime(slot.time)}
                  </button>
                )
              })}
            </div>
          )}
          {data && <p className="text-xs text-ink-500">Times are shown in {timezoneLabel(data.timezone)}.</p>}
        </>
      )}
    </section>
  )
}
