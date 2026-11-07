import { request } from './client'

export const bookAppointment = ({ doctorId, date, time, reason }) =>
  request({ method: 'post', url: '/appointments', data: { doctorId, date, time, ...(reason ? { reason } : {}) } })

export const listAppointments = (params) => request({ method: 'get', url: '/appointments', params })

export const getAppointment = (id) => request({ method: 'get', url: `/appointments/${id}` })

export const cancelAppointment = (id, reason) =>
  request({ method: 'patch', url: `/appointments/${id}/cancel`, data: { reason } })

export const rescheduleAppointment = (id, { date, time }) =>
  request({ method: 'patch', url: `/appointments/${id}/reschedule`, data: { date, time } })

export const reviewAppointment = (id, { rating, comment }) =>
  request({ method: 'post', url: `/appointments/${id}/review`, data: { rating, comment } })
