import { request } from './client'

export const listDoctors = (params) => request({ method: 'get', url: '/doctors', params })

export const getDoctor = (id) => request({ method: 'get', url: `/doctors/${id}` })

export const getSlots = (id, params) => request({ method: 'get', url: `/doctors/${id}/slots`, params })

export const getReviews = (id, params) => request({ method: 'get', url: `/doctors/${id}/reviews`, params })
