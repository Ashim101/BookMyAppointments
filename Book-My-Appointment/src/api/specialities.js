import { request } from './client'

export const listSpecialities = () => request({ method: 'get', url: '/specialities' })
