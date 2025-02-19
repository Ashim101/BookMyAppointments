import { describe, expect, it } from 'vitest'
import { createStore, connectApiClient } from '../../store'
import { mockApi, ok, fail } from '../../test/http'
import { request } from '../../api/client'
import { AUTH_STORAGE_KEY } from '../../lib/config'
import { clearSession, selectIsAuthenticated, selectUser, setSession, signIn, signOut, updateUser } from './authSlice'

const session = {
  accessToken: 'a1',
  refreshToken: 'r1',
  user: { id: 'p1', name: 'Asha', email: 'asha@example.com', role: 'patient', image: null },
}
const stored = () => JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))

describe('auth slice', () => {
  it('starts logged out when storage is empty', () => {
    const store = createStore()
    expect(selectIsAuthenticated(store.getState())).toBe(false)
    expect(selectUser(store.getState())).toBeNull()
  })

  it('hydrates from localStorage and ignores corrupt data', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
    expect(selectUser(createStore().getState()).name).toBe('Asha')
    localStorage.setItem(AUTH_STORAGE_KEY, '{not json')
    expect(selectIsAuthenticated(createStore().getState())).toBe(false)
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken: 'only' }))
    expect(selectIsAuthenticated(createStore().getState())).toBe(false)
  })

  it('persists the session, user updates and logout', () => {
    const store = createStore()
    store.dispatch(setSession(session))
    expect(stored()).toEqual(session)
    store.dispatch(updateUser({ name: 'Asha K', image: 'x.png' }))
    expect(stored().user).toMatchObject({ name: 'Asha K', image: 'x.png', email: 'asha@example.com' })
    store.dispatch(clearSession())
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('signIn stores tokens returned by the API', async () => {
    mockApi(() => ok(session))
    const store = createStore()
    await store.dispatch(signIn({ email: 'asha@example.com', password: 'secret123' }))
    expect(selectIsAuthenticated(store.getState())).toBe(true)
    expect(stored().refreshToken).toBe('r1')
  })

  it('signOut calls /auth/logout and clears the session even if the call fails', async () => {
    const calls = mockApi(() => fail(500, 'INTERNAL'))
    const store = createStore({ auth: { tokens: session } })
    await store.dispatch(signOut())
    expect(calls[0].url).toBe('/auth/logout')
    expect(JSON.parse(calls[0].data)).toEqual({ refreshToken: 'r1' })
    expect(selectIsAuthenticated(store.getState())).toBe(false)
  })

  it('stores refreshed tokens and logs out through the connected api client', async () => {
    const store = createStore({ auth: { tokens: session } })
    const redirect = vi.fn()
    connectApiClient(store, redirect)

    mockApi((config) => {
      if (config.url === '/auth/refresh') return ok({ ...session, accessToken: 'a2', refreshToken: 'r2' })
      return config.headers.Authorization === 'Bearer a2' ? ok('done') : fail(401, 'TOKEN_EXPIRED')
    })
    await expect(request({ url: '/secure' })).resolves.toBe('done')
    expect(stored().refreshToken).toBe('r2')

    mockApi(() => fail(401, 'TOKEN_EXPIRED'))
    await request({ url: '/secure' }).catch(() => {})
    expect(redirect).toHaveBeenCalledWith('/login')
    expect(selectIsAuthenticated(store.getState())).toBe(false)
  })
})
