import { forwardRef } from 'react'
import Field, { controlClass } from './Field'

/** `options` is a list of `{ value, label }`; use `placeholder` for an empty first option. */
const Select = forwardRef(function Select(
  { label, error, hint, options = [], placeholder, className = '', wrapperClass, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClass}>
      <select ref={ref} className={`${controlClass(error)} ${className}`} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
})

export default Select
