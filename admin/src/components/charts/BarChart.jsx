import { useState } from 'react'
import { bandScale } from '../../lib/scale'
import { ChartEmpty, H, Legend, PALETTE, Tooltip, W, XAxis, YAxis, axisFor, plotArea } from './parts'

/**
 * Vertical bars, grouped by default or `stacked`. Every group is focusable, so
 * the tooltip is reachable from the keyboard as well as the pointer.
 */
export default function BarChart({ data, xKey, xFormat = String, series, stacked = false, valueFormat = String, label }) {
  const [active, setActive] = useState(null)
  if (!data?.length || data.every((d) => series.every((s) => !d[s.key]))) return <ChartEmpty />

  const area = plotArea(false)
  const totals = data.map((d) => (stacked ? series.reduce((sum, s) => sum + d[s.key], 0) : Math.max(...series.map((s) => d[s.key]))))
  const axis = axisFor(totals, area)
  const bands = bandScale(data.length, [area.x0, area.x1], 0.3)
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? PALETTE[i % PALETTE.length] }))
  const barWidth = stacked ? bands.width : bands.width / series.length

  return (
    <figure>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={label} onMouseLeave={() => setActive(null)}>
          <YAxis axis={axis} area={area} format={valueFormat} />
          <XAxis labels={data.map((d) => xFormat(d[xKey]))} position={bands.center} area={area} />
          {data.map((d, i) => {
            let stackTop = 0
            return (
              <g
                key={d[xKey]}
                tabIndex={0}
                role="img"
                aria-label={`${xFormat(d[xKey])}: ${colored.map((s) => `${s.label} ${valueFormat(d[s.key])}`).join(', ')}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none [&:focus-visible_rect.hit]:stroke-brand-500"
              >
                <rect className="hit" x={bands.step * i + area.x0} y={area.y1} width={bands.step} height={area.y0 - area.y1} fill={active === i ? '#f1f5f9' : 'transparent'} stroke="transparent" strokeWidth="2" />
                {colored.map((s, k) => {
                  const base = stacked ? stackTop : 0
                  const top = axis.scale(base + d[s.key])
                  const bottom = axis.scale(base)
                  stackTop += stacked ? d[s.key] : 0
                  return (
                    <rect
                      key={s.key}
                      x={stacked ? bands.start(i) : bands.start(i) + barWidth * k}
                      y={top}
                      width={barWidth}
                      height={Math.max(bottom - top, 0)}
                      rx="2"
                      fill={s.color}
                    />
                  )
                })}
              </g>
            )
          })}
        </svg>
        {active !== null && (
          <Tooltip
            x={bands.center(active)}
            title={xFormat(data[active][xKey])}
            rows={colored.map((s) => ({ label: s.label, color: s.color, value: valueFormat(data[active][s.key]) }))}
          />
        )}
      </div>
      <Legend items={colored} />
    </figure>
  )
}
