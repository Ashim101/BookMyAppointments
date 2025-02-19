import Badge from '../ui/Badge'

const STATUS = {
  booked: ['Booked', 'info'],
  completed: ['Completed', 'success'],
  cancelled: ['Cancelled', 'danger'],
  no_show: ['No show', 'warning'],
}

const PAYMENT = {
  unpaid: ['Payment due', 'warning'],
  paid: ['Paid', 'success'],
  refund_pending: ['Refund pending', 'info'],
  refunded: ['Refunded', 'neutral'],
}

export function StatusBadge({ status }) {
  const [label, tone] = STATUS[status] ?? [status, 'neutral']
  return <Badge tone={tone}>{label}</Badge>
}

export function PaymentBadge({ status }) {
  const [label, tone] = PAYMENT[status] ?? [status, 'neutral']
  return <Badge tone={tone}>{label}</Badge>
}
