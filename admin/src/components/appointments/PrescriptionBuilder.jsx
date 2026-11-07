import { FiArrowDown, FiArrowUp, FiPlus, FiTrash2 } from 'react-icons/fi'
import { emptyRow, moveRow } from '../../lib/prescription'
import Button from '../ui/Button'
import Input from '../ui/Input'

/** Editable list of prescription rows. `errors` is an array aligned with `rows`. */
export default function PrescriptionBuilder({ rows, onChange, errors = [] }) {
  const patch = (index, changes) => onChange(rows.map((r, i) => (i === index ? { ...r, ...changes } : r)))
  const text = (index, field) => (e) => patch(index, { [field]: e.target.value })

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium text-slate-700">Prescription</legend>
      {rows.length === 0 && <p className="text-sm text-slate-500">No medicines added.</p>}
      {rows.map((row, i) => {
        const e = errors[i] ?? {}
        return (
          <div key={row.key} role="group" aria-label={`Medicine ${i + 1}`} className="rounded-lg border border-slate-200 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Medicine" value={row.medicine} error={e.medicine} onChange={text(i, 'medicine')} />
              <Input label="Dosage" placeholder="500 mg" value={row.dosage} error={e.dosage} onChange={text(i, 'dosage')} />
              <Input label="Frequency" placeholder="Twice a day" value={row.frequency} error={e.frequency} onChange={text(i, 'frequency')} />
              <Input label="Duration (days)" inputMode="numeric" value={row.durationDays} error={e.durationDays} onChange={text(i, 'durationDays')} />
              <Input wrapperClass="sm:col-span-2" label="Instructions" placeholder="After meals" value={row.instructions} onChange={text(i, 'instructions')} />
            </div>
            <div className="mt-2 flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => onChange(moveRow(rows, i, -1))} disabled={i === 0} aria-label={`Move medicine ${i + 1} up`}>
                <FiArrowUp aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onChange(moveRow(rows, i, 1))} disabled={i === rows.length - 1} aria-label={`Move medicine ${i + 1} down`}>
                <FiArrowDown aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label={`Remove medicine ${i + 1}`}>
                <FiTrash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        )
      })}
      <Button variant="secondary" size="sm" onClick={() => onChange([...rows, emptyRow()])}>
        <FiPlus aria-hidden="true" /> Add medicine
      </Button>
    </fieldset>
  )
}
