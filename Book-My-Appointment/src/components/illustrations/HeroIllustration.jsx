export default function HeroIllustration({ className }) {
  return (
    <svg viewBox="0 0 480 400" className={className} role="img" aria-label="A doctor beside a booked appointment calendar">
      <circle cx="240" cy="210" r="168" fill="#d3f5ee" />
      <circle cx="396" cy="88" r="22" fill="#a9ebdd" />
      <circle cx="70" cy="300" r="14" fill="#a9ebdd" />
      <path d="M92 120h14m-7-7v14" stroke="#22a692" strokeWidth="5" strokeLinecap="round" />
      <path d="M410 300h12m-6-6v12" stroke="#22a692" strokeWidth="4" strokeLinecap="round" />

      <g transform="translate(250 70)">
        <rect width="190" height="210" rx="18" fill="#fff" stroke="#16554e" strokeWidth="4" />
        <path d="M0 52h190V36a18 18 0 0 0-18-18H18A18 18 0 0 0 0 36z" fill="#188677" />
        <rect x="42" y="2" width="9" height="30" rx="4.5" fill="#16554e" />
        <rect x="139" y="2" width="9" height="30" rx="4.5" fill="#16554e" />
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={22 + col * 38}
              y={72 + row * 34}
              width="26"
              height="22"
              rx="6"
              fill={row === 1 && col === 2 ? '#188677' : '#eefbf8'}
            />
          )),
        )}
        <path d="M119 126l5 5 10-11" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <g transform="translate(70 120)">
        <path d="M18 270c0-62 30-100 78-100s78 38 78 100z" fill="#fff" stroke="#16554e" strokeWidth="4" strokeLinejoin="round" />
        <path d="M96 172l-26 40 26 22 26-22z" fill="#a9ebdd" stroke="#16554e" strokeWidth="4" strokeLinejoin="round" />
        <path d="M70 176c-10 26-6 52 14 62m52-62c10 26 6 52-14 62" stroke="#14212b" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="84" cy="242" r="9" fill="#fff" stroke="#14212b" strokeWidth="4" />
        <rect x="88" y="142" width="16" height="30" rx="7" fill="#f2c9a5" />
        <ellipse cx="96" cy="108" rx="40" ry="44" fill="#f2c9a5" />
        <path d="M54 104c-4-40 22-60 46-58 26 2 44 22 38 58-12-22-30-30-48-26-14 3-26 12-36 26z" fill="#14212b" />
        <circle cx="82" cy="112" r="3.5" fill="#14212b" />
        <circle cx="110" cy="112" r="3.5" fill="#14212b" />
        <path d="M84 130q12 10 24 0" stroke="#14212b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <rect x="132" y="226" width="40" height="30" rx="6" fill="#188677" />
        <path d="M144 241h16m-8-8v16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export function NotFoundIllustration({ className }) {
  return (
    <svg viewBox="0 0 240 160" className={className} role="img" aria-label="An empty calendar page">
      <circle cx="120" cy="82" r="68" fill="#d3f5ee" />
      <rect x="62" y="36" width="116" height="92" rx="12" fill="#fff" stroke="#16554e" strokeWidth="3" />
      <path d="M62 62h116V48a12 12 0 0 0-12-12H74a12 12 0 0 0-12 12z" fill="#188677" />
      <path d="M96 88l24 24m0-24L96 112" stroke="#22a692" strokeWidth="5" strokeLinecap="round" />
      <path d="M130 88h24m-24 12h18" stroke="#a9ebdd" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
