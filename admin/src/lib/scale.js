/** Linear mapping from a numeric domain to a pixel range. */
export function linearScale([d0, d1], [r0, r1]) {
  const span = d1 - d0
  return (value) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0))
}

/** Evenly spaced bands for categorical axes. */
export function bandScale(count, [r0, r1], padding = 0.2) {
  const step = count ? (r1 - r0) / count : 0
  const width = step * (1 - padding)
  return {
    width,
    step,
    start: (index) => r0 + step * index + (step - width) / 2,
    center: (index) => r0 + step * index + step / 2,
  }
}

/** "Nice" tick values (1, 2, 5 times a power of ten) covering [min, max]. */
export function niceTicks(min, max, target = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (min === max) return max === 0 ? [0, 1] : niceTicks(Math.min(0, min), Math.max(0, max), target)
  const rough = (max - min) / Math.max(1, target)
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
  const ticks = []
  let v = Math.floor(min / step) * step
  for (;;) {
    ticks.push(Number(v.toFixed(10)))
    if (v >= max) break
    v += step
  }
  return ticks
}

/** Picks at most `max` evenly distributed indexes so x labels do not collide. */
export function labelIndexes(count, max) {
  const all = Array.from({ length: count }, (_, i) => i)
  if (count <= max) return all
  const stride = Math.ceil(count / max)
  return all.filter((i) => i % stride === 0)
}

const polar = (cx, cy, r, angle) => [cx + r * Math.sin(angle), cy - r * Math.cos(angle)]

/** SVG path for a donut slice between two angles (radians, clockwise from 12 o'clock). */
export function arcPath(cx, cy, inner, outer, start, end) {
  const sweep = Math.min(end - start, Math.PI * 2 - 0.0001)
  const stop = start + sweep
  const large = sweep > Math.PI ? 1 : 0
  const [x0, y0] = polar(cx, cy, outer, start)
  const [x1, y1] = polar(cx, cy, outer, stop)
  const [x2, y2] = polar(cx, cy, inner, stop)
  const [x3, y3] = polar(cx, cy, inner, start)
  return `M${x0} ${y0}A${outer} ${outer} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${inner} ${inner} 0 ${large} 0 ${x3} ${y3}Z`
}
