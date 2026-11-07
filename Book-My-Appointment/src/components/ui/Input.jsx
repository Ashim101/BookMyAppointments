import { forwardRef } from 'react'
import Field from './Field'
import { controlClasses } from './controlClasses'
import { cx } from './cx'

const Input = forwardRef(function Input({ label, error, hint, className, wrapperClassName, ...rest }, ref) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClassName}>
      {(aria) => <input ref={ref} className={cx(controlClasses(error), className)} {...aria} {...rest} />}
    </Field>
  )
})

export default Input
