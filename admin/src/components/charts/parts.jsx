import { labelIndexes, linearScale, niceTicks } from '../../lib/scale'

export const PALETTE = ['#1d8179', '#d97706', '#7c3aed', '#0284c7', '#e11d48', '#64748b']

export const W = 640
export const H = 260

export function plotArea(hasRightAxis) {
  const margin = { top: 12, right: hasRightAxis ? 52 : 16, bottom: 30, left: 52 }
  return { margin, x0: margin.left, x1: W - margin.right, y0: H - margin.bottom, y1: margin.top }
}

/** Axis domain and ticks for a list of values, always starting at zero. */
export function axisFor(values, area) {
  const ticks = niceTicks(0, Math.max(...values, 0), 4)
  const domain = [ticks[0], ticks[ticks.length - 1]]
  return { ticks, scale: linearScale(domain, [area.y0, area.y1]) }
}

export function YAxis({ axis, area, format, side = 'left', grid = true }) {
  const x = side === 'left' ? area.x0 : area.x1
  return (
    <g aria-hidden="true">
      {axis.ticks.map((t) => (
        <g key={t}>
          {grid && <line x1={area.x0} x2={area.x1} y1={axis.scale(t)} y2={axis.scale(t)} stroke="#e2e8f0" />}
          <text
            x={side === 'left' ? x - 8 : x + 8}
            y={axis.scale(t)}
            dy="0.32em"
            textAnchor={side === 'left' ? 'end' : 'start'}
            className="fill-slate-500 text-[10px]"
          >
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

export function XAxis({ labels, position, area }) {
  const shown = labelIndexes(labels.length, 7)
  return (
    <g aria-hidden="true">
      <line x1={area.x0} x2={area.x1} y1={area.y0} y2={area.y0} stroke="#94a3b8" />
      {shown.map((i) => (
        <text key={i} x={position(i)} y={area.y0 + 16} textAnchor="middle" className="fill-slate-500 text-[10px]">
          {labels[i]}
        </text>
      ))}
    </g>
  )
}

export function Legend({ items }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/** HTML tooltip placed by percentage so it follows the scaled SVG. */
export function Tooltip({ x, title, rows }) {
  const left = (x / W) * 100
  return (
    <div
      role="status"
      style={{ left: `${left}%`, transform: left > 65 ? 'translateX(-105%)' : 'translateX(8px)' }}
      className="pointer-events-none absolute top-2 z-10 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
    >
      <p className="mb-1 font-semibold">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
          {r.label}: <span className="font-medium">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

export function ChartEmpty({ message = 'No data for this period' }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
      {message}
    </div>
  )
}
