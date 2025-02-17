import { useId } from 'react'
import { cx } from './cx'

/** Controlled tabs. `tabs` is [{ id, label }]; the panel content is rendered by the caller. */
export default function Tabs({ tabs, active, onChange, label, children }) {
  const baseId = useId()

  const onKeyDown = (event) => {
    const index = tabs.findIndex((t) => t.id === active)
    const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!move) return
    event.preventDefault()
    const next = tabs[(index + move + tabs.length) % tabs.length]
    onChange(next.id)
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus()
  }

  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cx(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
                selected ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-900',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`} tabIndex={0} className="pt-4 outline-none">
        {children}
      </div>
    </div>
  )
}
