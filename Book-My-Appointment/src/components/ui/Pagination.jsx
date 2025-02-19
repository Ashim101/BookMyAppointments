import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { cx } from './cx'

function pageWindow(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap', p] : [p]))
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  const item = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium'
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={cx(item, 'text-ink-700 hover:bg-slate-100 disabled:text-ink-300 disabled:hover:bg-transparent')}
      >
        <FiChevronLeft />
      </button>
      {pageWindow(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-ink-500" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            className={cx(item, p === page ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-slate-100')}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className={cx(item, 'text-ink-700 hover:bg-slate-100 disabled:text-ink-300 disabled:hover:bg-transparent')}
      >
        <FiChevronRight />
      </button>
    </nav>
  )
}
