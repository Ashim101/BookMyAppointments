import { forwardRef } from 'react'
import Field from './Field'
import { controlClass } from './controlClass'

const Textarea = forwardRef(function Textarea(
  { label, error, hint, rows = 3, className = '', wrapperClass, ...rest },
  ref,
) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClass}>
      <textarea ref={ref} rows={rows} className={`${controlClass(error)} ${className}`} {...rest} />
    </Field>
  )
})

export default Textarea
