export const APPOINTMENT_STATUS = {
  booked: { label: 'Booked', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  no_show: { label: 'No-show', tone: 'warning' },
}

export const PAYMENT_STATUS = {
  unpaid: { label: 'Unpaid', tone: 'neutral' },
  paid: { label: 'Paid', tone: 'success' },
  refund_pending: { label: 'Refund pending', tone: 'warning' },
  refunded: { label: 'Refunded', tone: 'info' },
}

export const statusOptions = Object.entries(APPOINTMENT_STATUS).map(([value, { label }]) => ({ value, label }))
