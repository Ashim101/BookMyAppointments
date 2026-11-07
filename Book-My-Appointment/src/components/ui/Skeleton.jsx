import { cx } from './cx'

export default function Skeleton({ className }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-md bg-slate-200', className)} />
}
