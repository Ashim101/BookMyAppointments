import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { bookAppointment } from '../../api/appointments'
import { selectIsAuthenticated } from '../../features/auth/authSlice'
import { useAction } from '../../hooks/useQuery'
import { errorMessage } from '../../lib/errors'
import { formatCurrency, formatDate, formatTime } from '../../lib/format'
import { validateReason } from '../../lib/validation'
import Button from '../ui/Button'
import Textarea from '../ui/Textarea'
import SlotPicker from './SlotPicker'

const SLOT_ERRORS = ['SLOT_TAKEN', 'SLOT_UNAVAILABLE']

export default function BookingPanel({ doctor }) {
  const [params] = useSearchParams()
  const initial = params.get('date') && params.get('time') ? { date: params.get('date'), time: params.get('time') } : null
  const [selected, setSelected] = useState(initial)
  const [reason, setReason] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [notice, setNotice] = useState('')
  const authenticated = useSelector(selectIsAuthenticated)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const booking = useAction(bookAppointment)
  const reasonError = validateReason(reason)

  const book = async () => {
    if (!authenticated) {
      const back = `${pathname}?date=${selected.date}&time=${selected.time}`
      navigate('/login', { state: { from: back } })
      return
    }
    setNotice('')
    try {
      await booking.run({ doctorId: doctor.id, date: selected.date, time: selected.time, reason: reason.trim() })
      toast.success('Appointment booked. You can pay for it from your appointments.')
      navigate('/my-appointments')
    } catch (error) {
      if (SLOT_ERRORS.includes(error.code)) {
        setNotice(`${errorMessage(error)} We have refreshed the available times.`)
        setSelected(null)
        setRefreshKey((k) => k + 1)
      } else {
        toast.error(errorMessage(error))
      }
    }
  }

  if (!doctor.available) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        {doctor.name} is not accepting new bookings right now. Please check back soon or choose another doctor.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {notice && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      )}
      <SlotPicker doctorId={doctor.id} selected={selected} onSelect={setSelected} refreshKey={refreshKey} />
      {selected && (
        <div className="space-y-4 rounded-xl bg-brand-50 p-4">
          <p className="text-sm text-ink-700">
            Your selection: <strong>{formatDate(selected.date)}</strong> at <strong>{formatTime(selected.time)}</strong>
            {' '}&middot; {formatCurrency(doctor.fees, doctor.currency)} consultation fee
          </p>
          <Textarea
            label="Reason for visit (optional)"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            error={reasonError}
            placeholder="Briefly describe your symptoms or what you would like to discuss"
          />
          <Button onClick={book} loading={booking.loading} disabled={Boolean(reasonError)}>
            {authenticated ? 'Confirm booking' : 'Sign in to book'}
          </Button>
        </div>
      )}
    </div>
  )
}
