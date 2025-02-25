/** Hand-drawn BookMyAppointments mark: a calendar page with a check, plus the wordmark. */
export function LogoMark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="BookMyAppointments">
      <rect width="32" height="32" rx="8" fill="#1d8179" />
      <rect x="7" y="8" width="18" height="17" rx="3" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M7 14h18" stroke="#fff" strokeWidth="2" />
      <path d="M12 6v4M20 6v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.5 19.5l2.5 2.5 4.5-4.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="leading-tight">
        <span className={`block text-sm font-semibold ${light ? 'text-white' : 'text-slate-900'}`}>BookMyAppointments</span>
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-brand-400">Staff</span>
      </span>
    </span>
  )
}
