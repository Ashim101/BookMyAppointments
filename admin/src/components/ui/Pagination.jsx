import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import Button from './Button'

export default function Pagination({ page, totalPages, total, limit, onChange }) {
  if (!total) return null
  const first = (page - 1) * limit + 1
  const last = Math.min(page * limit, total)
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-sm text-slate-600">
      <p>
        Showing {first}-{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <FiChevronLeft aria-hidden="true" /> Prev
        </Button>
        <span aria-current="page">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button variant="secondary" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          Next <FiChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
