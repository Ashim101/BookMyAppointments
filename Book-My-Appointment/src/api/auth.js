import { request } from './client'

const ROLE = 'patient'

export const requestOtp = (email) => request({ method: 'post', url: '/auth/otp/request', data: { email } })

export const register = ({ name, email, password, otp }) =>
  request({ method: 'post', url: '/auth/register', data: { name, email, password, otp } })

export const login = ({ email, password }) =>
  request({ method: 'post', url: '/auth/login', data: { email, password, role: ROLE } })

export const googleLogin = (credential) => request({ method: 'post', url: '/auth/google', data: { credential } })

export const logout = (refreshToken) => request({ method: 'post', url: '/auth/logout', data: { refreshToken } })

export const forgotPassword = (email) =>
  request({ method: 'post', url: '/auth/password/forgot', data: { email, role: ROLE } })

export const resetPassword = ({ token, password }) =>
  request({ method: 'post', url: '/auth/password/reset', data: { token, password } })

export const me = () => request({ method: 'get', url: '/auth/me' })
