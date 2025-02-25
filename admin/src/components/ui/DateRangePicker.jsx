import { RANGE_PRESETS } from '../../lib/date'
import Button from './Button'
import Input from './Input'

/**
 * Two native date inputs. The opposite input is constrained so the range is never inverted.
 * With `presets`, quick-pick buttons and a clear button are shown.
 */
export default function DateRangePicker({ from, to, onChange, fromLabel = 'From', toLabel = 'To', presets = false }) {
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
      {presets && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick ranges">
          {RANGE_PRESETS.map((p) => (
            <Button key={p.label} variant="secondary" size="sm" onClick={() => onChange(p.range())}>
              {p.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => onChange({ from: '', to: '' })} disabled={!from && !to}>
            Clear dates
          </Button>
        </div>
      )}
    </div>
  )
}
