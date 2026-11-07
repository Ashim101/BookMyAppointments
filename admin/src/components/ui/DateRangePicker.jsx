import Input from './Input'

/** Two native date inputs. The opposite input is constrained so the range is never inverted. */
export default function DateRangePicker({ from, to, onChange, fromLabel = 'From', toLabel = 'To' }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        type="date"
        label={fromLabel}
        value={from ?? ''}
        max={to || undefined}
        onChange={(e) => onChange({ from: e.target.value, to })}
      />
      <Input
        type="date"
        label={toLabel}
        value={to ?? ''}
        min={from || undefined}
        onChange={(e) => onChange({ from, to: e.target.value })}
      />
    </div>
  )
}
