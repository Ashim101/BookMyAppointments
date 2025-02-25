import { useState } from 'react'
import { initials } from '../../lib/format'

const PALETTE = [
  'bg-brand-100 text-brand-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-emerald-100 text-emerald-800',
]
const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' }

const colorFor = (name) => PALETTE[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % PALETTE.length]

/** Shows the photo when there is one, otherwise the person's initials. */
export default function Avatar({ name = '', src, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false)
  const base = `inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${className}`
  if (src && !failed) {
    return <img src={src} alt={name} onError={() => setFailed(true)} className={`${base} object-cover`} />
  }
  return (
    <span role="img" aria-label={name || 'Unknown'} className={`${base} ${colorFor(name)}`}>
      {initials(name)}
    </span>
  )
}
