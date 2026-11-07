import { act, renderHook, waitFor } from '@testing-library/react'
import { useFetch, useMutation } from '../../src/hooks/useFetch'
import { useFilters } from '../../src/hooks/useFilters'
import { useDebounce } from '../../src/hooks/useTimers'
import { ApiError } from '../../src/api/client'

const defer = () => {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('useFetch', () => {
  it('loads data and exposes errors', async () => {
    const good = renderHook(() => useFetch(() => Promise.resolve('data')))
    expect(good.result.current.loading).toBe(true)
    await waitFor(() => expect(good.result.current.data).toBe('data'))
    expect(good.result.current.loading).toBe(false)

    const bad = renderHook(() => useFetch(() => Promise.reject(new ApiError({ code: 'INTERNAL', message: 'nope' }))))
    await waitFor(() => expect(bad.result.current.error?.message).toBe('nope'))
  })

  it('ignores a slow earlier response when deps change', async () => {
    const slow = defer()
    const fast = defer()
    const { result, rerender } = renderHook(({ id }) => useFetch(() => (id === 1 ? slow.promise : fast.promise), [id]), {
      initialProps: { id: 1 },
    })
    rerender({ id: 2 })
    await act(async () => fast.resolve('second'))
    await act(async () => slow.resolve('first'))
    expect(result.current.data).toBe('second')
  })

  it('does not fetch when disabled and supports manual updates and reloads', async () => {
    const fetcher = vi.fn().mockResolvedValue(1)
    const { result, rerender } = renderHook(({ enabled }) => useFetch(fetcher, [], { enabled }), { initialProps: { enabled: false } })
    expect(fetcher).not.toHaveBeenCalled()
    rerender({ enabled: true })
    await waitFor(() => expect(result.current.data).toBe(1))
    act(() => result.current.setData((n) => n + 1))
    expect(result.current.data).toBe(2)
    await act(async () => result.current.reload())
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(result.current.data).toBe(1)
  })
})

describe('useMutation', () => {
  it('reports ok results and failures without throwing', async () => {
    const { result } = renderHook(() => useMutation((x) => (x ? Promise.resolve('done') : Promise.reject(new ApiError({ code: 'CONFLICT' })))))
    let outcome
    await act(async () => {
      outcome = await result.current.run(true)
    })
    expect(outcome).toEqual({ ok: true, data: 'done' })
    await act(async () => {
      outcome = await result.current.run(false)
    })
    expect(outcome.ok).toBe(false)
    expect(outcome.error.code).toBe('CONFLICT')
    expect(result.current.pending).toBe(false)
  })
})

describe('useFilters', () => {
  const defaults = { search: '', status: '', page: 1 }

  it('resets to page 1 on filter changes but keeps explicit page changes', () => {
    const { result } = renderHook(() => useFilters('t1', defaults))
    act(() => result.current.update({ page: 3 }))
    expect(result.current.filters.page).toBe(3)
    act(() => result.current.update({ status: 'booked' }))
    expect(result.current.filters).toEqual({ search: '', status: 'booked', page: 1 })
    expect(result.current.dirty).toBe(true)
    act(() => result.current.reset())
    expect(result.current.filters).toEqual(defaults)
    expect(result.current.dirty).toBe(false)
  })

  it('persists filters per table and restores them on page 1', () => {
    const first = renderHook(() => useFilters('t2', defaults))
    act(() => first.result.current.update({ search: 'asha' }))
    act(() => first.result.current.update({ page: 4 }))
    const second = renderHook(() => useFilters('t2', defaults))
    expect(second.result.current.filters).toEqual({ search: 'asha', status: '', page: 1 })
    expect(renderHook(() => useFilters('other', defaults)).result.current.filters).toEqual(defaults)
  })

  it('tolerates corrupt stored values', () => {
    localStorage.setItem('bma.staff.filters.t3', '{oops')
    expect(renderHook(() => useFilters('t3', defaults)).result.current.filters).toEqual(defaults)
  })
})

describe('useDebounce', () => {
  it('delays updates until the value settles', async () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 200), { initialProps: { v: 'a' } })
    rerender({ v: 'ab' })
    rerender({ v: 'abc' })
    expect(result.current).toBe('a')
    await act(async () => vi.advanceTimersByTime(199))
    expect(result.current).toBe('a')
    await act(async () => vi.advanceTimersByTime(1))
    expect(result.current).toBe('abc')
    vi.useRealTimers()
  })
})
