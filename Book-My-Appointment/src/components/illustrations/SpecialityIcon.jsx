const ICONS = {
  general: (
    <>
      <path d="M7 3v6a5 5 0 0 0 10 0V3" />
      <path d="M12 14v2a4 4 0 0 0 8 0v-1" />
      <circle cx="20" cy="13" r="2" />
    </>
  ),
  gynae: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M12 14v8M8.5 18h7" />
    </>
  ),
  derma: (
    <>
      <path d="M12 3c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-11z" />
      <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
    </>
  ),
  paeds: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      <path d="M9 9.5h.01M15 9.5h.01" strokeWidth="2.5" />
      <path d="M12 3c-1-1.5 0-2 1.5-1.5" />
    </>
  ),
  neuro: (
    <>
      <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 5 2V4a3 3 0 0 0-2 0z" />
      <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-5 2V4a3 3 0 0 1 2 0z" />
    </>
  ),
  gastro: (
    <>
      <path d="M9 3v4c0 2-4 3-4 8a6 6 0 0 0 12 0c0-3-2-4-4-5V7" />
      <path d="M9 3h4" />
    </>
  ),
  cardio: (
    <>
      <path d="M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11z" />
      <path d="M6 12h3l1.5-3 3 6 1.5-3H18" />
    </>
  ),
  ortho: (
    <>
      <path d="M8.5 8.5l7 7" />
      <circle cx="6" cy="8" r="2" />
      <circle cx="8" cy="6" r="2" />
      <circle cx="16" cy="18" r="2" />
      <circle cx="18" cy="16" r="2" />
    </>
  ),
  fallback: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
}

const MATCHERS = [
  [/physician|general|family/, 'general'],
  [/gyn|obstet|women/, 'gynae'],
  [/derma|skin/, 'derma'],
  [/p(a)?ediatric|child/, 'paeds'],
  [/neuro|brain/, 'neuro'],
  [/gastro|digest/, 'gastro'],
  [/cardi|heart/, 'cardio'],
  [/ortho|bone|joint/, 'ortho'],
]

function iconKeyFor(slug = '') {
  return MATCHERS.find(([pattern]) => pattern.test(slug.toLowerCase()))?.[1] ?? 'fallback'
}

export default function SpecialityIcon({ slug, size = 28, className }) {
  const key = iconKeyFor(slug)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-icon={key}
      aria-hidden="true"
    >
      {ICONS[key]}
    </svg>
  )
}
