import { useState } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { createOrder, verifyPayment } from '../../api/payments'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { BRAND } from '../../lib/config'
import { errorMessage } from '../../lib/errors'
import { formatCurrency } from '../../lib/format'
import { loadRazorpay } from '../../lib/razorpay'
import { selectUser } from '../auth/authSlice'

/**
 * Starts a payment for an appointment. Returns `pay(appointment)`, the id being processed and a
 * `dialog` element that must be rendered (it hosts the test-payment confirmation in mock mode).
 */
export function usePayment({ onPaid }) {
  const user = useSelector(selectUser)
  const [busyId, setBusyId] = useState(null)
  const [mock, setMock] = useState(null)

  const settle = async (appointment, order, paymentId, signature) => {
    const updated = await verifyPayment({ appointmentId: appointment.id, orderId: order.orderId, paymentId, signature })
    toast.success('Payment received. Thank you!')
    onPaid?.(updated)
  }

  const openCheckout = async (appointment, order) => {
    const Razorpay = await loadRazorpay()
    await new Promise((resolve) => {
      const checkout = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: BRAND,
        description: `Appointment with ${appointment.doctor.name}`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#188677' },
        handler: async (response) => {
          try {
            await settle(appointment, order, response.razorpay_payment_id, response.razorpay_signature)
          } catch (error) {
            toast.error(errorMessage(error))
          }
          resolve()
        },
        modal: { ondismiss: resolve },
      })
      checkout.on?.('payment.failed', (event) => toast.error(event?.error?.description || 'The payment failed. Please try again.'))
      checkout.open()
    })
  }

  const pay = async (appointment) => {
    setBusyId(appointment.id)
    try {
      const order = await createOrder(appointment.id)
      if (order.mode === 'mock') setMock({ appointment, order })
      else await openCheckout(appointment, order)
    } catch (error) {
      toast.error(error.code ? errorMessage(error) : error.message)
    } finally {
      setBusyId(null)
    }
  }

  const confirmMock = async () => {
    setBusyId(mock.appointment.id)
    try {
      await settle(mock.appointment, mock.order, `mock_${Date.now()}`, 'mock')
      setMock(null)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  const dialog = (
    <ConfirmDialog
      open={Boolean(mock)}
      title="Test payment"
      confirmLabel={mock ? `Pay ${formatCurrency(mock.order.amount, mock.order.currency)} (test)` : 'Pay'}
      loading={Boolean(mock) && busyId === mock.appointment.id}
      onConfirm={confirmMock}
      onClose={() => setMock(null)}
      message={
        <div className="space-y-2">
          <p>
            This is a <strong>test payment</strong>. The server is running in mock payment mode, so no card is needed and no real
            money will be charged.
          </p>
          {mock && (
            <p>
              Appointment with {mock.appointment.doctor.name} &middot; {formatCurrency(mock.order.amount, mock.order.currency)}
            </p>
          )}
        </div>
      }
    />
  )

  return { pay, busyId, dialog }
}
