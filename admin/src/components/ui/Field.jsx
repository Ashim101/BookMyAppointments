import { cloneElement, useId } from 'react'

/** Label, hint and error wrapper shared by Input, Select and Textarea. */
export default function Field({ label, error, hint, className = '', children }) {
  const generated = useId()
  const id = children.props.id ?? generated
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {children.props.required && (
            <span className="text-red-600" aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
      )}
      {cloneElement(children, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
