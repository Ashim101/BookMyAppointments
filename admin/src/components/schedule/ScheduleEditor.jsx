import { useMemo, useState } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { dayName, formatTime } from '../../lib/date'
import { SLOT_OPTIONS, generateSlots, toApiSchedule, toFormState, validateSchedule } from '../../lib/schedule'
import Button from '../ui/Button'
import Select from '../ui/Select'
import Toggle from '../ui/Toggle'

const timeInput = 'rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200'

function DayRow({ day, index, errors, onChange }) {
  const name = dayName(day.day)
  const patch = (changes) => onChange({ ...day, ...changes })
  const setBreak = (i, changes) => patch({ breaks: day.breaks.map((b, j) => (j === i ? { ...b, ...changes } : b)) })

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Toggle checked={day.enabled} onChange={(enabled) => patch({ enabled })} label={`${name} working day`} />
        <span className="w-24 text-sm font-medium text-slate-800">{name}</span>
        {day.enabled ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <input type="time" aria-label={`${name} start`} value={day.start} onChange={(e) => patch({ start: e.target.value })} className={timeInput} />
            to
            <input type="time" aria-label={`${name} end`} value={day.end} onChange={(e) => patch({ end: e.target.value })} className={timeInput} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => patch({ breaks: [...day.breaks, { start: '13:00', end: '14:00' }] })}
              aria-label={`Add break on ${name}`}
            >
              <FiPlus aria-hidden="true" /> Break
            </Button>
          </div>
        ) : (
          <span className="text-sm text-slate-400">Day off</span>
        )}
      </div>
      {errors[`${index}.hours`] && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {errors[`${index}.hours`]}
        </p>
      )}
      {day.enabled &&
        day.breaks.map((b, i) => (
          <div key={i} className="mt-2 pl-14">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="w-12">Break</span>
              <input type="time" aria-label={`${name} break ${i + 1} start`} value={b.start} onChange={(e) => setBreak(i, { start: e.target.value })} className={timeInput} />
              to
              <input type="time" aria-label={`${name} break ${i + 1} end`} value={b.end} onChange={(e) => setBreak(i, { end: e.target.value })} className={timeInput} />
              <Button variant="ghost" size="sm" onClick={() => patch({ breaks: day.breaks.filter((_, j) => j !== i) })} aria-label={`Remove ${name} break ${i + 1}`}>
                <FiTrash2 aria-hidden="true" />
              </Button>
            </div>
            {errors[`${index}.break.${i}`] && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {errors[`${index}.break.${i}`]}
              </p>
            )}
          </div>
        ))}
    </div>
  )
}

function SlotPreview({ state }) {
  const enabled = state.days.filter((d) => d.enabled)
  const [chosen, setChosen] = useState(null)
  const day = enabled.find((d) => d.day === chosen) ?? enabled[0]
  const slots = useMemo(() => generateSlots(day, state.slotMinutes), [day, state.slotMinutes])
  if (!day) return null

  return (
    <section aria-label="Slot preview" className="rounded-lg bg-slate-50 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Slot preview ({slots.length} slots)</h3>
        <select
          aria-label="Preview day"
          value={day.day}
          onChange={(e) => setChosen(Number(e.target.value))}
          className={timeInput}
        >
          {enabled.map((d) => (
            <option key={d.day} value={d.day}>
              {dayName(d.day)}
            </option>
          ))}
        </select>
      </div>
      {slots.length === 0 ? (
        <p className="text-sm text-slate-500">No bookable slots with these settings.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {slots.map((t) => (
            <li key={t} className="rounded-md bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
              {formatTime(t)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Controlled schedule form: slot length, per-day hours and breaks, with inline errors and a slot preview. */
export function ScheduleFields({ state, onChange, errors }) {
  return (
    <div className="space-y-3">
      <Select
        label="Slot length"
        value={state.slotMinutes}
        error={errors.slotMinutes}
        onChange={(e) => onChange({ ...state, slotMinutes: Number(e.target.value) })}
        options={SLOT_OPTIONS.map((m) => ({ value: m, label: `${m} minutes` }))}
        wrapperClass="max-w-xs"
      />
      {errors.days && (
        <p role="alert" className="text-xs text-red-600">
          {errors.days}
        </p>
      )}
      {state.days.map((day, i) => (
        <DayRow key={day.day} day={day} index={i} errors={errors} onChange={(d) => onChange({ ...state, days: state.days.map((x, j) => (j === i ? d : x)) })} />
      ))}
      <SlotPreview state={state} />
    </div>
  )
}

/** Self-contained editor used by doctors and by admins editing a doctor's schedule. */
export default function ScheduleEditor({ schedule, onSave, saving = false }) {
  const [state, setState] = useState(() => toFormState(schedule))
  const errors = useMemo(() => validateSchedule(state), [state])
  const invalid = Object.keys(errors).length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!invalid) onSave(toApiSchedule(state))
      }}
      className="space-y-4"
    >
      <ScheduleFields state={state} onChange={setState} errors={errors} />
      <div className="flex items-center justify-end gap-3">
        {invalid && <span className="text-xs text-red-600">Fix the highlighted problems to save.</span>}
        <Button type="submit" loading={saving} disabled={invalid}>
          Save schedule
        </Button>
      </div>
    </form>
  )
}
