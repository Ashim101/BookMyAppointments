import { client } from './client'

export const getProfile = () => client.get('/doctor/profile')
export const updateProfile = (body) => client.patch('/doctor/profile', body)

export const getSchedule = () => client.get('/doctor/schedule')
export const saveSchedule = (schedule) => client.put('/doctor/schedule', schedule)

export const listLeaves = () => client.get('/doctor/leaves')
export const addLeave = (body) => client.post('/doctor/leaves', body)
export const deleteLeave = (id) => client.delete(`/doctor/leaves/${id}`)

export const getDashboard = () => client.get('/doctor/dashboard')

export const patientHistory = (patientId) => client.get(`/doctor/patients/${patientId}/appointments`)
