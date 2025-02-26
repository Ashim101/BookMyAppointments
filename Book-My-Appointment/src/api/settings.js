import { request } from './client'

export const getPublicSettings = () => request({ method: 'get', url: '/settings/public' })
