import { FiClock, FiMail, FiPhone } from 'react-icons/fi'
import { usePageTitle } from '../hooks/usePageTitle'
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '../lib/config'

const FAQ = [
  {
    q: 'How do I cancel or reschedule?',
    a: 'Open My appointments, then choose Cancel or Reschedule on the booking. Changes are available until the cutoff shown in the cancellation dialog.',
  },
  {
    q: 'When will I be charged?',
    a: 'Only when you choose Pay now on a booked appointment. Paid appointments that are cancelled in time are refunded.',
  },
  {
    q: 'Where can I find my prescription?',
    a: 'Once the doctor completes your visit, open the appointment from My appointments to read the notes and print the prescription.',
  },
  {
    q: 'I did not receive my verification code.',
    a: 'Check your spam folder, then use Resend code after the countdown ends. If it still does not arrive, write to us.',
  },
]

export default function Contact() {
  usePageTitle('Contact')
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <section>
        <h1 className="text-3xl font-extrabold text-ink-900 sm:text-4xl">Contact us</h1>
        <p className="mt-3 text-lg text-ink-700">Questions about a booking, your account or a payment? We are happy to help.</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          <li className="card flex items-start gap-3 p-5">
            <FiMail className="mt-1 text-brand-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Email</h2>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm text-brand-700 hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </div>
          </li>
          <li className="card flex items-start gap-3 p-5">
            <FiPhone className="mt-1 text-brand-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Phone</h2>
              <p className="text-sm text-ink-700">{SUPPORT_PHONE}</p>
            </div>
          </li>
          <li className="card flex items-start gap-3 p-5">
            <FiClock className="mt-1 text-brand-600" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold">Support hours</h2>
              <p className="text-sm text-ink-700">Monday to Friday, 9:00 to 18:00</p>
            </div>
          </li>
        </ul>
      </section>

      <section aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="mb-4 text-2xl font-bold text-ink-900">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="card group p-5">
              <summary className="cursor-pointer list-none font-semibold text-ink-900 marker:hidden">{q}</summary>
              <p className="mt-2 text-sm text-ink-700">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
