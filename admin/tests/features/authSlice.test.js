import { makeStore, bindSession } from '../../src/store'
import { loadInitialState, sessionCleared, signIn, signOut } from '../../src/features/auth/authSlice'
import { STORAGE_KEY, emitSession, readSession, writeSession } from '../../src/api/session'
import { fail, mockHttp, ok, session } from '../helpers/http'

const storeFromStorage = () => makeStore({ auth: loadInitialState() })

describe('auth slice', () => {
  it('starts signed out without stored tokens', () => {
    expect(storeFromStorage().getState().auth.user).toBeNull()
  })

  it('restores a stored staff session', () => {
    writeSession(session())
    expect(storeFromStorage().getState().auth).toMatchObject({ accessToken: 'old', user: { role: 'doctor' } })
  })

  it('ignores corrupt storage and patient sessions', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(storeFromStorage().getState().auth.user).toBeNull()
    writeSession(session({ user: { id: 'p', name: 'P', email: 'p@x.io', role: 'patient', image: null } }))
    expect(storeFromStorage().getState().auth.user).toBeNull()
  })

  it('signs in, persists the tokens under bma.staff.auth and sends the role', async () => {
    const calls = mockHttp(() => ok(session({ accessToken: 'fresh' })))
    const store = storeFromStorage()
    await store.dispatch(signIn({ email: 'a@b.io', password: 'secret123', role: 'doctor' }))
    expect(JSON.parse(calls[0].data)).toEqual({ email: 'a@b.io', password: 'secret123', role: 'doctor' })
    expect(store.getState().auth.accessToken).toBe('fresh')
    expect(JSON.parse(localStorage.getItem('bma.staff.auth')).accessToken).toBe('fresh')
  })

  it('rejects with the API error and stores nothing on failure', async () => {
    mockHttp(() => fail(401, 'INVALID_CREDENTIALS', 'Nope'))
    const store = storeFromStorage()
    const result = await store.dispatch(signIn({ email: 'a@b.io', password: 'x', role: 'admin' }))
    expect(result.payload).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(store.getState().auth.user).toBeNull()
    expect(readSession()).toBeNull()
  })

  it('refuses patient accounts', async () => {
    mockHttp(() => ok(session({ user: { id: 'p', name: 'P', email: 'p@x.io', role: 'patient', image: null } })))
    const store = storeFromStorage()
    const result = await store.dispatch(signIn({ email: 'p@x.io', password: 'x', role: 'doctor' }))
    expect(result.payload.code).toBe('FORBIDDEN')
    expect(readSession()).toBeNull()
  })

  it('signs out through the API and clears storage even if the call fails', async () => {
    writeSession(session())
    const store = storeFromStorage()
    mockHttp(() => fail(500, 'INTERNAL'))
    await store.dispatch(signOut())
    expect(store.getState().auth.user).toBeNull()
    expect(readSession()).toBeNull()
  })

  it('follows refresh and logout events emitted by the client', async () => {
    const store = storeFromStorage()
    const off = bindSession(store)
    emitSession('refresh', session({ accessToken: 'rotated' }))
    expect(store.getState().auth.accessToken).toBe('rotated')
    writeSession(session())
    emitSession('logout')
    expect(store.getState().auth.user).toBeNull()
    expect(readSession()).toBeNull()
    off()
  })

  it('clears persistence on sessionCleared', () => {
    writeSession(session())
    const store = storeFromStorage()
    store.dispatch(sessionCleared())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
