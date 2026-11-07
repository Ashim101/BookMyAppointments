import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Drawer from '../../components/ui/Drawer'
import { dayName, formatTime } from '../../lib/date'
import { formatAddress, formatCurrency } from '../../lib/format'
import { DAY_ORDER } from '../../lib/schedule'

function ScheduleSummary({ schedule }) {
  const byDay = new Map(schedule.weekly.map((w) => [w.day, w]))
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
      {DAY_ORDER.map((day) => {
        const entry = byDay.get(day)
        return (
          <li key={day} className="flex justify-between gap-3 px-3 py-2">
            <span className="font-medium text-slate-700">{dayName(day)}</span>
            <span className="text-right text-slate-600">
              {entry ? `${formatTime(entry.start)} to ${formatTime(entry.end)}` : 'Day off'}
              {entry?.breaks.map((b) => (
                <span key={b.start} className="block text-xs text-slate-400">
                  Break {formatTime(b.start)} to {formatTime(b.end)}
                </span>
              ))}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Read-only overview of a doctor, opened from the doctors table. */
export default function DoctorDetail({ doctor, onClose }) {
  return (
    <Drawer open={Boolean(doctor)} onClose={onClose} title="Doctor profile" width="max-w-xl">
      {doctor && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar name={doctor.name} src={doctor.image} size="lg" />
            <div>
              <p className="text-lg font-semibold text-slate-900">{doctor.name}</p>
              <p className="text-sm text-slate-500">
                {doctor.specialityName} · {doctor.degree} · {doctor.experienceYears} years
              </p>
              <div className="mt-1 flex gap-2">
                <Badge tone={doctor.active ? 'success' : 'neutral'}>{doctor.active ? 'Active' : 'Inactive'}</Badge>
                <Badge tone={doctor.available ? 'brand' : 'warning'}>{doctor.available ? 'Accepting bookings' : 'Not accepting bookings'}</Badge>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Fees</dt>
              <dd className="font-medium">{formatCurrency(doctor.fees, doctor.currency)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Rating</dt>
              <dd className="font-medium">{doctor.rating.count ? `${doctor.rating.average} (${doctor.rating.count} reviews)` : 'No reviews'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Address</dt>
              <dd className="font-medium">{formatAddress(doctor.address)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">About</dt>
              <dd className="whitespace-pre-wrap">{doctor.about}</dd>
            </div>
          </dl>
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Weekly schedule ({doctor.schedule.slotMinutes} minute slots)</h3>
            <ScheduleSummary schedule={doctor.schedule} />
          </section>
        </div>
      )}
    </Drawer>
  )
}
