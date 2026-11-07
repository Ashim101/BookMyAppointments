import { useEffect, useState } from 'react'
import { FiSearch } from 'react-icons/fi'
import { SORT_OPTIONS } from '../../lib/doctorQuery'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

export default function DoctorFilters({ query, specialities, recent, onChange, onClear, onSearchCommitted, onClearRecent }) {
  const [text, setText] = useState(query.search)
  const [feeError, setFeeError] = useState('')

  useEffect(() => setText(query.search), [query.search])

  useEffect(() => {
    if (text === query.search) return undefined
    const timer = setTimeout(() => onChange({ search: text.trim() }), 350)
    return () => clearTimeout(timer)
  }, [text, query.search, onChange])

  const submit = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const minFee = form.get('minFee')
    const maxFee = form.get('maxFee')
    if (minFee && maxFee && Number(minFee) > Number(maxFee)) {
      setFeeError('Minimum fee cannot be higher than the maximum')
      return
    }
    setFeeError('')
    onSearchCommitted(text)
    onChange({ search: text.trim(), minFee, maxFee })
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5" aria-label="Filter doctors" role="search">
      <div>
        <Input
          label="Search by name"
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Nair"
          autoComplete="off"
        />
        {!text && recent.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="Recent searches">
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setText(term)
                  onChange({ search: term })
                }}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-ink-700 hover:bg-slate-200"
              >
                <FiSearch size={11} aria-hidden="true" /> {term}
              </button>
            ))}
            <button type="button" onClick={onClearRecent} className="text-xs text-ink-500 underline">
              Clear
            </button>
          </div>
        )}
      </div>
      <Select
        label="Speciality"
        value={query.speciality}
        onChange={(e) => onChange({ speciality: e.target.value })}
        placeholder="All specialities"
        options={specialities.map((s) => ({ value: s.slug, label: s.name }))}
      />
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink-700">Consultation fee</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input
            key={`min-${query.minFee}`}
            label="Min"
            name="minFee"
            type="number"
            min="0"
            inputMode="numeric"
            defaultValue={query.minFee}
          />
          <Input
            key={`max-${query.maxFee}`}
            label="Max"
            name="maxFee"
            type="number"
            min="0"
            inputMode="numeric"
            defaultValue={query.maxFee}
            error={feeError}
          />
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input
          type="checkbox"
          checked={query.available}
          onChange={(e) => onChange({ available: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        Accepting bookings only
      </label>
      <Select label="Sort by" value={query.sort} onChange={(e) => onChange({ sort: e.target.value })} options={SORT_OPTIONS} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1">
          Apply
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onClear}>
          Clear all
        </Button>
      </div>
    </form>
  )
}
