import { cx } from './cx'

export const controlClasses = (error) =>
  cx(
    'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300',
    'disabled:cursor-not-allowed disabled:bg-slate-100',
    error ? 'border-red-500' : 'border-slate-300',
  )
