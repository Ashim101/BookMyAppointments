import { APPOINTMENT_STATUS, PAYMENT_STATUS } from '../lib/status'
import Badge from './ui/Badge'

export default function StatusBadge({ status, kind = 'appointment' }) {
  const map = kind === 'payment' ? PAYMENT_STATUS : APPOINTMENT_STATUS
  const entry = map[status] ?? { label: status, tone: 'neutral' }
  return <Badge tone={entry.tone}>{entry.label}</Badge>
}
