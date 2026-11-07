import { clean, client } from './client'

export const listNotifications = (params) => client.get('/notifications', { params: clean(params) })
export const markRead = (id) => client.patch(`/notifications/${id}/read`)
export const markAllRead = () => client.patch('/notifications/read-all')
