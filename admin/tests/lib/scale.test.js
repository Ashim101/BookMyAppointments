import { bandScale, labelIndexes, linearScale, niceTicks } from '../../src/lib/scale'

describe('linearScale', () => {
  it('maps the domain onto the range', () => {
    const s = linearScale([0, 100], [200, 0])
    expect(s(0)).toBe(200)
    expect(s(50)).toBe(100)
    expect(s(100)).toBe(0)
  })

  it('returns the range midpoint for a flat domain', () => {
    expect(linearScale([5, 5], [0, 10])(5)).toBe(5)
  })
})

describe('bandScale', () => {
  it('centres bands within equal steps', () => {
    const b = bandScale(4, [0, 400], 0.5)
    expect(b.step).toBe(100)
    expect(b.width).toBe(50)
    expect(b.start(1)).toBe(125)
    expect(b.center(1)).toBe(150)
  })

  it('handles zero bands', () => {
    expect(bandScale(0, [0, 100]).step).toBe(0)
  })
})

describe('niceTicks', () => {
  it('produces round steps covering the range', () => {
    expect(niceTicks(0, 100, 5)).toEqual([0, 20, 40, 60, 80, 100])
    expect(niceTicks(0, 7, 5)).toEqual([0, 2, 4, 6, 8])
    expect(niceTicks(0, 1, 4)).toEqual([0, 0.5, 1])
  })

  it('handles degenerate input', () => {
    expect(niceTicks(0, 0)).toEqual([0, 1])
    expect(niceTicks(NaN, 3)).toEqual([0, 1])
    const flat = niceTicks(10, 10)
    expect(flat[0]).toBe(0)
    expect(flat[flat.length - 1]).toBeGreaterThanOrEqual(10)
  })

  it('works for large numbers', () => {
    const ticks = niceTicks(0, 12345, 5)
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(12345)
    expect(ticks[1] - ticks[0]).toBe(5000)
  })
})

describe('labelIndexes', () => {
  it('keeps every label when they fit', () => {
    expect(labelIndexes(3, 5)).toEqual([0, 1, 2])
  })

  it('thins labels with a stride', () => {
    expect(labelIndexes(10, 4)).toEqual([0, 3, 6, 9])
  })
})
