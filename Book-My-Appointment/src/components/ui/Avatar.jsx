import { useState } from 'react'
import { initials } from '../../lib/format'
import { cx } from './cx'

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-12 w-12 text-sm', lg: 'h-24 w-24 text-2xl', xl: 'h-32 w-32 text-3xl' }
const PALETTE = ['bg-brand-100 text-brand-800', 'bg-sky-100 text-sky-800', 'bg-amber-100 text-amber-900', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800']

function paletteFor(name = '') {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return PALETTE[hash % PALETTE.length]
}

export default function Avatar({ name, src, size = 'md', className }) {
  const [failed, setFailed] = useState(false)
  const base = cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold', SIZES[size], className)

  if (src && !failed) {
    return <img src={src} alt={name} onError={() => setFailed(true)} className={cx(base, 'object-cover')} />
  }
  return (
    <span role="img" aria-label={name} className={cx(base, paletteFor(name))}>
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  )
}
