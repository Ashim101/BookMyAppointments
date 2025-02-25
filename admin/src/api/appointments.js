import { clean, client, download } from './client'

export const listAppointments = (params) => client.get('/appointments', { params: clean(params) })

export const cancelAppointment = (id, reason) => client.patch(`/appointments/${id}/cancel`, { reason })

export const completeAppointment = (id, body) => client.patch(`/appointments/${id}/complete`, body)

export const markNoShow = (id) => client.patch(`/appointments/${id}/no-show`)

export const exportAppointments = (params) => download('/admin/appointments/export', params, 'appointments.csv')
