import { BRAND } from './config'

const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const escapeText = (text) => String(text).replace(/\\/g, '\\\\').replace(/[,;]/g, '\\$&').replace(/\r?\n/g, '\\n')

export function buildIcs(appointment, now = new Date()) {
  const { id, doctor, startsAt, endsAt, reason } = appointment
  const location = [doctor.address?.line1, doctor.address?.line2, doctor.address?.city].filter(Boolean).join(', ')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${BRAND}//Appointments//EN`,
    'BEGIN:VEVENT',
    `UID:${id}@bookmyappointments`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(startsAt)}`,
    `DTEND:${stamp(endsAt)}`,
    `SUMMARY:${escapeText(`Appointment with ${doctor.name}`)}`,
    `DESCRIPTION:${escapeText(reason || doctor.specialityName)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}

export function downloadIcs(appointment) {
  const blob = new Blob([buildIcs(appointment)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `appointment-${appointment.date}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
