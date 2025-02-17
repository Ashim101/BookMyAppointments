import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bodyOf, fail, mockApi, ok } from '../test/http'
import { ApiError, configureClient, request } from './client'

const tokens = (n) => ({ accessToken: `access-${n}`, refreshToken: `refresh-${n}`, user: { id: 'u1' } })

let current
const onLogout = vi.fn()

beforeEach(() => {
  current = tokens(1)
  configureClient({
    getTokens: () => current,
    onTokens: (next) => {
      current = next
    },
    onLogout,
  })
})

describe('api client', () => {
  it('unwraps the success envelope and sends the bearer token', async () => {
    const calls = mockApi(() => ok({ hello: 'world' }))
    await expect(request({ method: 'get', url: '/ping' })).resolves.toEqual({ hello: 'world' })
    expect(calls[0].headers.Authorization).toBe('Bearer access-1')
  })

  it('maps the error envelope to an ApiError', async () => {
    mockApi(() => fail(422, 'SLOT_UNAVAILABLE', 'gone', [{ path: 'time', message: 'bad' }]))
    const error = await request({ method: 'post', url: '/appointments' }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'SLOT_UNAVAILABLE', message: 'gone', status: 422 })
    expect(error.details).toEqual([{ path: 'time', message: 'bad' }])
  })

  it('maps a missing response to NETWORK_ERROR', async () => {
    mockApi(() => {
      throw new Error('socket hang up')
    })
    const error = await request({ url: '/x' }).catch((e) => e)
    expect(error.code).toBe('NETWORK_ERROR')
  })

  it('rejects bodies that are not an envelope', async () => {
    mockApi(() => ({ status: 200, body: { nope: true } }))
    await expect(request({ url: '/x' })).rejects.toMatchObject({ code: 'INTERNAL' })
  })

  it('refreshes once for concurrent TOKEN_EXPIRED responses, then retries each request', async () => {
    let refreshCalls = 0
    const calls = mockApi(async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls += 1
        await new Promise((r) => setTimeout(r, 10))
        return ok(tokens(2))
      }
      return config.headers.Authorization === 'Bearer access-2' ? ok({ url: config.url }) : fail(401, 'TOKEN_EXPIRED')
    })

    const results = await Promise.all([request({ url: '/a' }), request({ url: '/b' }), request({ url: '/c' })])

    expect(results).toEqual([{ url: '/a' }, { url: '/b' }, { url: '/c' }])
    expect(refreshCalls).toBe(1)
    const refresh = calls.find((c) => c.url === '/auth/refresh')
    expect(bodyOf(refresh)).toEqual({ refreshToken: 'refresh-1' })
    expect(current.accessToken).toBe('access-2')
    expect(onLogout).not.toHaveBeenCalled()
  })

  it('retries a request only once', async () => {
    const calls = mockApi((config) => (config.url === '/auth/refresh' ? ok(tokens(2)) : fail(401, 'TOKEN_EXPIRED')))
    await expect(request({ url: '/a' })).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' })
    expect(calls.filter((c) => c.url === '/a')).toHaveLength(2)
  })

  it('logs out when the refresh fails', async () => {
    mockApi((config) => (config.url === '/auth/refresh' ? fail(401, 'UNAUTHORIZED') : fail(401, 'TOKEN_EXPIRED')))
    const results = await Promise.allSettled([request({ url: '/a' }), request({ url: '/b' })])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(results[0].reason.code).toBe('TOKEN_EXPIRED')
    expect(onLogout).toHaveBeenCalled()
  })

  it('does not try to refresh for other 401 codes', async () => {
    const calls = mockApi(() => fail(401, 'INVALID_CREDENTIALS'))
    await expect(request({ url: '/auth/login' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(calls).toHaveLength(1)
  })
})
