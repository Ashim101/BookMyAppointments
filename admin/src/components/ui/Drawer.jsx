import { useId } from 'react'
import { createPortal } from 'react-dom'
import { FiX } from 'react-icons/fi'
import { useDialog } from '../../hooks/useDialog'

export default function Drawer({ open, onClose, title, footer, width = 'max-w-lg', children }) {
  const ref = useDialog(open, onClose)
  const titleId = useId()
  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" onMouseDown={onClose}>
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex h-full w-full flex-col bg-white shadow-xl ${width}`}
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close panel" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <FiX className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  )
}
