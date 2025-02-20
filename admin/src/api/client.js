import axios from 'axios'
import { clearSession, emitSession, readSession, writeSession } from './session'

export class ApiError extends Error {
  constructor({ code = 'INTERNAL', message = 'Request failed', details = [], status = 0 } = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}

export const client = axios.create({ baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api` })

async function toApiError(error) {
  if (error instanceof ApiError) return error
  const response = error.response
  if (!response) {
    return new ApiError({ code: 'NETWORK_ERROR', message: 'Cannot reach the server. Check your connection.' })
  }
  let body = response.data
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      body = JSON.parse(await body.text())
    } catch {
      body = null
    }
  }
  const info = body?.error
  return new ApiError({
    code: info?.code ?? 'INTERNAL',
    message: info?.message ?? error.message,
    details: info?.details ?? [],
    status: response.status,
  })
}

client.interceptors.request.use((config) => {
  const session = config.skipAuth ? null : readSession()
  if (session) config.headers.Authorization = `Bearer ${session.accessToken}`
  return config
})

let refreshing = null

/** One refresh at a time: concurrent callers share the same promise. */
function refreshSession() {
  refreshing ||= (async () => {
    try {
      const current = readSession()
      if (!current) throw new ApiError({ code: 'UNAUTHORIZED', message: 'Not signed in', status: 401 })
      const tokens = await client.post(
        '/auth/refresh',
        { refreshToken: current.refreshToken },
        { skipAuth: true, skipRefresh: true },
      )
      writeSession(tokens)
      emitSession('refresh', tokens)
      return tokens
    } catch (error) {
      clearSession()
      emitSession('logout')
      throw error
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

client.interceptors.response.use(
  (response) => (response.config.responseType === 'blob' ? response : response.data?.data),
  async (error) => {
    const apiError = await toApiError(error)
    const config = error.config
    if (apiError.code === 'TOKEN_EXPIRED' && config && !config.skipRefresh && !config.retried) {
      await refreshSession()
      return client.request({ ...config, retried: true })
    }
    throw apiError
  },
)

export const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))

export function filenameFromHeaders(headers, fallback) {
  const disposition = headers?.['content-disposition'] ?? ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  return match ? decodeURIComponent(match[1]) : fallback
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Downloads a file from an authenticated endpoint. */
export async function download(path, params, fallbackName) {
  const response = await client.get(path, { params: clean(params), responseType: 'blob' })
  const filename = filenameFromHeaders(response.headers, fallbackName)
  saveBlob(response.data, filename)
  return filename
}
