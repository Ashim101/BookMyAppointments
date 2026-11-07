import { client } from './client'
import { clearSession, emitSession, readSession } from './session'

export const login = (body) => client.post('/auth/login', body, { skipAuth: true })

export const forgotPassword = (email) =>
  client.post('/auth/password/forgot', { email, role: 'doctor' }, { skipAuth: true })

export const resetPassword = (token, password) =>
  client.post('/auth/password/reset', { token, password }, { skipAuth: true })

export async function logout() {
  const session = readSession()
  try {
    if (session) await client.post('/auth/logout', { refreshToken: session.refreshToken }, { skipAuth: true })
  } finally {
    clearSession()
    emitSession('logout')
  }
}
