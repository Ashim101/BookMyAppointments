import { AxiosError } from 'axios'
import { http } from '../api/client'

export const ok = (data, status = 200) => ({ status, body: { success: true, data } })

export const fail = (status, code, message = 'Failed', details = []) => ({
  status,
  body: { success: false, error: { code, message, details } },
})

/** Routes every axios request through `handler(config)`, which returns `ok(...)` or `fail(...)`. */
export function mockApi(handler) {
  const calls = []
  http.defaults.adapter = async (config) => {
    calls.push(config)
    const { status, body } = await handler(config)
    const response = { data: body, status, statusText: '', headers: {}, config }
    if (status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response)
    return response
  }
  return calls
}

export const bodyOf = (config) => (typeof config.data === 'string' ? JSON.parse(config.data) : config.data)
