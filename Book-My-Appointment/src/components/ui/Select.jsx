import { forwardRef } from 'react'
import Field from './Field'
import { controlClasses } from './controlClasses'
import { cx } from './cx'

const Select = forwardRef(function Select(
  { label, error, hint, options, placeholder, className, wrapperClassName, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClassName}>
      {(aria) => (
        <select ref={ref} className={cx(controlClasses(error), className)} {...aria} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
})

export default Select
