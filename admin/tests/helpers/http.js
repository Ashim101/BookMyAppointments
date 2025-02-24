import { AxiosError } from 'axios'
import { client } from '../../src/api/client'

/** Replaces the axios adapter so no network is used. Returns the list of seen request configs. */
export function mockHttp(handler) {
  const calls = []
  client.defaults.adapter = async (config) => {
    calls.push(config)
    const { status = 200, data, headers = {} } = await handler(config, calls)
    const response = { status, data, headers, config, statusText: '' }
    if (status >= 400) throw new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response)
    return response
  }
  return calls
}

export const ok = (data, headers) => ({ data: { success: true, data }, headers })

export const fail = (status, code, message = 'Failure', details = []) => ({
  status,
  data: { success: false, error: { code, message, details } },
})

const matcher = (pattern) => new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`)

/**
 * Routes requests by "METHOD /path" (with `:param` segments). A route value is a
 * response from ok()/fail() or a function `(config) => response`. Unknown routes return 404.
 */
export function mockApi(routes) {
  const table = Object.entries(routes).map(([key, value]) => {
    const [method, path] = key.split(' ')
    return { method, test: matcher(path), value }
  })
  return mockHttp((config) => {
    const method = config.method.toUpperCase()
    const hit = table.find((r) => r.method === method && r.test.test(config.url))
    if (!hit) return fail(404, 'NOT_FOUND', `No mock for ${method} ${config.url}`)
    return typeof hit.value === 'function' ? hit.value(config) : hit.value
  })
}

export const body = (call) => JSON.parse(call.data)

export const session = (overrides = {}) => ({
  accessToken: 'old',
  refreshToken: 'refresh-1',
  user: { id: 'u1', name: 'Dr. Who', email: 'who@example.com', role: 'doctor', image: null },
  ...overrides,
})
