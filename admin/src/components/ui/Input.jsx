import { forwardRef } from 'react'
import Field, { controlClass } from './Field'

const Input = forwardRef(function Input({ label, error, hint, className = '', wrapperClass, ...rest }, ref) {
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClass}>
      <input ref={ref} className={`${controlClass(error)} ${className}`} {...rest} />
    </Field>
  )
})

export default Input
