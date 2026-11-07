import { useState } from 'react'
import { bandScale } from '../../lib/scale'
import { ChartEmpty, H, Legend, PALETTE, Tooltip, W, XAxis, YAxis, axisFor, plotArea } from './parts'

/**
 * Multi-series line chart. Series with `axis: 'right'` use a second scale, so
 * counts and money can share one chart. Arrow keys move the focused point.
 */
export default function LineChart({ data, xKey, xFormat = String, series, label }) {
  const [active, setActive] = useState(null)
  if (!data?.length || data.every((d) => series.every((s) => !d[s.key]))) return <ChartEmpty />

  const hasRight = series.some((s) => s.axis === 'right')
  const area = plotArea(hasRight)
  const left = axisFor(data.flatMap((d) => series.filter((s) => s.axis !== 'right').map((s) => d[s.key])), area)
  const right = hasRight ? axisFor(data.flatMap((d) => series.filter((s) => s.axis === 'right').map((s) => d[s.key])), area) : null
  const bands = bandScale(data.length, [area.x0, area.x1], 0)
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? PALETTE[i % PALETTE.length] }))
  const yFor = (s, v) => (s.axis === 'right' ? right : left).scale(v)

  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (event.key === 'Escape') setActive(null)
    if (!step) return
    event.preventDefault()
    setActive((i) => Math.min(data.length - 1, Math.max(0, (i ?? (step > 0 ? -1 : data.length)) + step)))
  }
  const onMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * W
    setActive(Math.min(data.length - 1, Math.max(0, Math.floor((x - area.x0) / bands.step))))
  }

  return (
    <figure>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          role="img"
          aria-label={label}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((i) => i ?? 0)}
          onBlur={() => setActive(null)}
          onMouseMove={onMove}
          onMouseLeave={() => setActive(null)}
        >
          <YAxis axis={left} area={area} format={colored.find((s) => s.axis !== 'right')?.axisFormat ?? String} />
          {right && <YAxis axis={right} area={area} side="right" grid={false} format={colored.find((s) => s.axis === 'right').axisFormat ?? String} />}
          <XAxis labels={data.map((d) => xFormat(d[xKey]))} position={bands.center} area={area} />
          {colored.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              points={data.map((d, i) => `${bands.center(i)},${yFor(s, d[s.key])}`).join(' ')}
            />
          ))}
          {active !== null && (
            <g>
              <line x1={bands.center(active)} x2={bands.center(active)} y1={area.y0} y2={area.y1} stroke="#94a3b8" strokeDasharray="3 3" />
              {colored.map((s) => (
                <circle key={s.key} cx={bands.center(active)} cy={yFor(s, data[active][s.key])} r="4" fill="#fff" stroke={s.color} strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>
        {active !== null && (
          <Tooltip
            x={bands.center(active)}
            title={xFormat(data[active][xKey])}
            rows={colored.map((s) => ({ label: s.label, color: s.color, value: (s.format ?? String)(data[active][s.key]) }))}
          />
        )}
      </div>
      <Legend items={colored} />
    </figure>
  )
}
