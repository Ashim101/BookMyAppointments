import { request } from './client'

export const createOrder = (appointmentId) => request({ method: 'post', url: '/payments/order', data: { appointmentId } })

export const verifyPayment = ({ appointmentId, orderId, paymentId, signature }) =>
  request({ method: 'post', url: '/payments/verify', data: { appointmentId, orderId, paymentId, signature } })
