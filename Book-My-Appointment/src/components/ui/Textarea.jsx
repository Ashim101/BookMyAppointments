import { forwardRef } from 'react'
import Field from './Field'
import { controlClasses } from './controlClasses'
import { cx } from './cx'

const Textarea = forwardRef(function Textarea(
  { label, error, hint, className, wrapperClassName, rows = 3, maxLength, value, ...rest },
  ref,
) {
  const counter = maxLength ? `${(value ?? '').length}/${maxLength}` : null
  return (
    <Field label={label} error={error} hint={hint} className={wrapperClassName}>
      {(aria) => (
        <>
          <textarea
            ref={ref}
            rows={rows}
            maxLength={maxLength}
            value={value}
            className={cx(controlClasses(error), 'resize-y', className)}
            {...aria}
            {...rest}
          />
          {counter && <span className="mt-1 block text-right text-xs text-ink-500">{counter}</span>}
        </>
      )}
    </Field>
  )
})

export default Textarea
