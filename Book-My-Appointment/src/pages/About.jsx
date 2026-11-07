import { FiClock, FiHeart, FiShield } from 'react-icons/fi'
import { ButtonLink } from '../components/ui/Button'
import { usePageTitle } from '../hooks/usePageTitle'
import { BRAND } from '../lib/config'

const VALUES = [
  { icon: FiClock, title: 'Respect for your time', text: 'Every slot you see is a real opening in the doctor’s calendar, so there is no guessing and no phone tag.' },
  { icon: FiShield, title: 'Privacy by default', text: 'Your records are yours. We only show doctors what they need to look after you, and nothing is shared publicly.' },
  { icon: FiHeart, title: 'Care, not clutter', text: 'We keep the experience simple so the focus stays on the visit: finding the right person and getting seen.' },
]

export default function About() {
  usePageTitle('About us')
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <section>
        <h1 className="text-3xl font-extrabold text-ink-900 sm:text-4xl">About {BRAND}</h1>
        <p className="mt-4 text-lg text-ink-700">
          {BRAND} connects patients with doctors who have time for them. Browse specialities, compare experience and ratings, choose
          a time that works and pay securely online. When plans change, rescheduling takes a few taps.
        </p>
        <p className="mt-3 text-ink-700">
          Behind the scenes, clinics keep control of their own schedules: working hours, breaks and days off are respected
          automatically, and two people can never book the same slot.
        </p>
      </section>

      <section aria-labelledby="values-heading">
        <h2 id="values-heading" className="mb-6 text-2xl font-bold text-ink-900">
          What we care about
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Icon aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-ink-900">{title}</h3>
              <p className="mt-1 text-sm text-ink-500">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-brand-50 p-8 text-center">
        <h2 className="text-2xl font-bold text-ink-900">Find your doctor today</h2>
        <p className="mt-2 text-ink-700">It takes less than a minute to see who is available this week.</p>
        <ButtonLink to="/doctors" className="mt-5">
          Browse doctors
        </ButtonLink>
      </section>
    </div>
  )
}
