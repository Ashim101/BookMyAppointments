import { request } from './client'

export const listNotifications = (params) => request({ method: 'get', url: '/notifications', params })

export const markRead = (id) => request({ method: 'patch', url: `/notifications/${id}/read` })

export const markAllRead = () => request({ method: 'patch', url: '/notifications/read-all' })
