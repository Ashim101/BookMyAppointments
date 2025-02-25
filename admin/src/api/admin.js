import { clean, client } from './client'

export const listPatients = (params) => client.get('/admin/patients', { params: clean(params) })
export const blockPatient = (id, blocked) => client.patch(`/admin/patients/${id}/block`, { blocked })

export const listReviews = (params) => client.get('/admin/reviews', { params: clean(params) })
export const deleteReview = (id) => client.delete(`/admin/reviews/${id}`)

export const listSpecialities = () => client.get('/admin/specialities')
export const createSpeciality = (body) => client.post('/admin/specialities', body)
export const updateSpeciality = (id, body) => client.patch(`/admin/specialities/${id}`, body)
export const deleteSpeciality = (id) => client.delete(`/admin/specialities/${id}`)

export const getSettings = () => client.get('/admin/settings')
export const saveSettings = (body) => client.put('/admin/settings', body)

export const listAuditLogs = (params) => client.get('/admin/audit-logs', { params: clean(params) })

export const getSummary = () => client.get('/admin/analytics/summary')
export const getTimeseries = (params) => client.get('/admin/analytics/timeseries', { params: clean(params) })
export const getSpecialityBreakdown = () => client.get('/admin/analytics/specialities')
export const getTopDoctors = (limit = 5) => client.get('/admin/analytics/top-doctors', { params: { limit } })
