import axios from 'axios'
import { API_URL } from '../lib/config'

export class ApiError extends Error {
  constructor({ code = 'INTERNAL', message = 'Unexpected error', details = [], status = 0 } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

export const http = axios.create({ baseURL: `${API_URL}/api`, timeout: 20_000 })

let hooks = { getTokens: () => null, onTokens: () => {}, onLogout: () => {} }
let refreshing = null

export function configureClient(next) {
  hooks = { ...hooks, ...next }
}

export function toApiError(error) {
  if (error instanceof ApiError) return error
  const response = error?.response
  if (!response) {
    return new ApiError({ code: 'NETWORK_ERROR', message: error?.message || 'Network error' })
  }
  const body = response.data?.error
  return new ApiError({
    code: body?.code || 'INTERNAL',
    message: body?.message || 'Request failed',
    details: body?.details || [],
    status: response.status,
  })
}

function refreshTokens() {
  if (!refreshing) {
    const current = hooks.getTokens()
    refreshing = http
      .post('/auth/refresh', { refreshToken: current?.refreshToken }, { _noRefresh: true, _noAuth: true })
      .then((tokens) => {
        hooks.onTokens(tokens)
        return tokens
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

http.interceptors.request.use((config) => {
  const tokens = hooks.getTokens()
  if (tokens?.accessToken && !config._noAuth) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && body.success === true) return body.data
    throw new ApiError({ code: 'INTERNAL', message: 'Malformed server response', status: response.status })
  },
  async (error) => {
    const apiError = toApiError(error)
    const config = error.config
    const canRetry = apiError.code === 'TOKEN_EXPIRED' && config && !config._retried && !config._noRefresh
    if (!canRetry) throw apiError
    config._retried = true
    try {
      await refreshTokens()
    } catch {
      hooks.onLogout()
      throw apiError
    }
    return http(config)
  },
)

export function request(config) {
  return http(config)
}
