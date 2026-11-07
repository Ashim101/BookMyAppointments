import { useMemo, useState } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import EmptyState from '../EmptyState'

/**
 * Columns: `{ key, header, render?, sortValue?, sortable?, className? }`.
 * Sorting is applied to the rows currently loaded (the API sorts server side).
 */
export default function DataTable({
  columns, rows, loading = false, rowKey = (r) => r.id, onRowClick, empty = 'Nothing to show yet.', skeletonRows = 5, caption,
}) {
  const [sort, setSort] = useState(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    const value = (row) => (col.sortValue ? col.sortValue(row) : row[col.key])
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = value(a)
      const y = value(b)
      if (x === y) return 0
      return (x > y ? 1 : -1) * factor
    })
  }, [rows, columns, sort])

  const toggle = (key) =>
    setSort((s) => (s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sortable ? 'none' : undefined}
                  className={`px-4 py-3 ${c.className ?? ''}`}
                >
                  {c.sortable ? (
                    <button type="button" onClick={() => toggle(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-800">
                      {c.header}
                      {active && (sort.dir === 'asc' ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />)}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading &&
            Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={`skeleton-${i}`} data-testid="skeleton-row">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3">
                    <div className="h-4 w-full max-w-[10rem] animate-pulse rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={onRowClick ? 'cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none' : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle text-slate-700 ${c.className ?? ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <EmptyState message={empty} />}
    </div>
  )
}
