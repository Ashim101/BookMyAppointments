import { useState } from 'react'
import { arcPath } from '../../lib/scale'
import { ChartEmpty, PALETTE } from './parts'

/** Donut with a legend; hovering or focusing a slice or a legend row highlights it. */
export default function DonutChart({ data, valueFormat = String, label, centerLabel = 'Total' }) {
  const [active, setActive] = useState(null)
  const total = (data ?? []).reduce((sum, d) => sum + d.value, 0)
  if (!total) return <ChartEmpty />

  let angle = 0
  const slices = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const start = angle
      angle += (d.value / total) * Math.PI * 2
      return { ...d, start, end: angle, color: d.color ?? PALETTE[i % PALETTE.length] }
    })
  const focused = slices.find((s) => s.label === active)

  return (
    <figure className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="group" aria-label={label}>
        {slices.map((s) => (
          <path
            key={s.label}
            d={arcPath(100, 100, active === s.label ? 56 : 60, active === s.label ? 96 : 92, s.start, s.end)}
            fill={s.color}
            tabIndex={0}
            role="img"
            aria-label={`${s.label}: ${valueFormat(s.value)} (${Math.round((s.value / total) * 100)}%)`}
            opacity={active && active !== s.label ? 0.45 : 1}
            className="outline-none focus-visible:stroke-slate-900"
            strokeWidth="2"
            stroke="#fff"
            onMouseEnter={() => setActive(s.label)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(s.label)}
            onBlur={() => setActive(null)}
          />
        ))}
        <text x="100" y="94" textAnchor="middle" className="fill-slate-500 text-[10px]">
          {focused ? focused.label : centerLabel}
        </text>
        <text x="100" y="114" textAnchor="middle" className="fill-slate-900 text-base font-semibold">
          {valueFormat(focused ? focused.value : total)}
        </text>
      </svg>
      <ul className="w-full space-y-1 text-sm">
        {slices.map((s) => (
          <li
            key={s.label}
            onMouseEnter={() => setActive(s.label)}
            onMouseLeave={() => setActive(null)}
            className="flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
            <span className="font-medium text-slate-900">{valueFormat(s.value)}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
