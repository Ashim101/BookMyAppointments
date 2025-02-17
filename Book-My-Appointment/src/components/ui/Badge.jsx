import { cx } from './cx'

const TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
}

export default function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone], className)}>
      {children}
    </span>
  )
}
