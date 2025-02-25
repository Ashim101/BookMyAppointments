import { ApiError, client, clean, filenameFromHeaders } from '../../src/api/client'
import { exportAppointments } from '../../src/api/appointments'
import { toDoctorFormData } from '../../src/api/doctors'
import { logout } from '../../src/api/auth'
import { readSession, subscribeSession, writeSession } from '../../src/api/session'
import { fail, mockHttp, ok, session } from '../helpers/http'

describe('api client', () => {
  it('unwraps the success envelope and sends the bearer token', async () => {
    writeSession(session({ accessToken: 'abc' }))
    const calls = mockHttp(() => ok({ hello: 'world' }))
    await expect(client.get('/ping')).resolves.toEqual({ hello: 'world' })
    expect(calls[0].headers.Authorization).toBe('Bearer abc')
  })

  it('skips the header for public calls and when signed out', async () => {
    const calls = mockHttp(() => ok(null))
    await client.get('/ping')
    expect(calls[0].headers.Authorization).toBeUndefined()
    writeSession(session())
    await client.get('/ping', { skipAuth: true })
    expect(calls[1].headers.Authorization).toBeUndefined()
  })

  it('maps error envelopes to ApiError', async () => {
    mockHttp(() => fail(400, 'VALIDATION_ERROR', 'Bad input', [{ path: 'email', message: 'Invalid' }]))
    const error = await client.post('/x', {}).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Bad input', status: 400 })
    expect(error.details).toEqual([{ path: 'email', message: 'Invalid' }])
  })

  it('reports network failures with a dedicated code', async () => {
    client.defaults.adapter = () => Promise.reject(Object.assign(new Error('down'), { config: {} }))
    await expect(client.get('/x')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('shares one refresh between concurrent TOKEN_EXPIRED responses and retries each once', async () => {
    writeSession(session())
    const events = []
    const off = subscribeSession((event, tokens) => events.push([event, tokens.accessToken]))
    const calls = mockHttp(async (config) => {
      if (config.url === '/auth/refresh') {
        await new Promise((r) => setTimeout(r, 10))
        return ok(session({ accessToken: 'new', refreshToken: 'refresh-2' }))
      }
      return config.headers.Authorization === 'Bearer new' ? ok({ path: config.url }) : fail(401, 'TOKEN_EXPIRED')
    })

    const results = await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')])

    expect(results.map((r) => r.path)).toEqual(['/a', '/b', '/c'])
    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1)
    expect(JSON.parse(calls.find((c) => c.url === '/auth/refresh').data)).toEqual({ refreshToken: 'refresh-1' })
    expect(calls).toHaveLength(7)
    expect(readSession()).toMatchObject({ accessToken: 'new', refreshToken: 'refresh-2' })
    expect(events).toEqual([['refresh', 'new']])
    off()
  })

  it('does not retry more than once', async () => {
    writeSession(session())
    const calls = mockHttp((config) =>
      config.url === '/auth/refresh' ? ok(session({ accessToken: 'new' })) : fail(401, 'TOKEN_EXPIRED'),
    )
    await expect(client.get('/a')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' })
    expect(calls.filter((c) => c.url === '/a')).toHaveLength(2)
  })

  it('clears the session and signals logout when the refresh fails', async () => {
    writeSession(session())
    const events = []
    const off = subscribeSession((event) => events.push(event))
    mockHttp((config) => (config.url === '/auth/refresh' ? fail(401, 'UNAUTHORIZED') : fail(401, 'TOKEN_EXPIRED')))

    await expect(client.get('/a')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })

    expect(readSession()).toBeNull()
    expect(events).toEqual(['logout'])
    off()
  })

  it('treats other 401 codes as plain errors without refreshing', async () => {
    writeSession(session())
    const calls = mockHttp(() => fail(401, 'INVALID_CREDENTIALS'))
    await expect(client.get('/a')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(calls).toHaveLength(1)
  })

  it('logout posts the refresh token and always clears the session', async () => {
    writeSession(session())
    const calls = mockHttp(() => fail(500, 'INTERNAL'))
    await expect(logout()).rejects.toMatchObject({ code: 'INTERNAL' })
    expect(JSON.parse(calls[0].data)).toEqual({ refreshToken: 'refresh-1' })
    expect(readSession()).toBeNull()
  })
})

describe('csv export', () => {
  it('downloads a blob with the auth header and the server filename', async () => {
    writeSession(session({ accessToken: 'tok' }))
    const calls = mockHttp(() => ({
      data: new Blob(['id,date\n1,2026-01-01']),
      headers: { 'content-disposition': 'attachment; filename="appointments-2026-01.csv"' },
    }))
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    let downloaded
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function stub() {
      downloaded = this.download
    })

    const name = await exportAppointments({ status: 'booked', doctorId: '', from: undefined })

    expect(name).toBe('appointments-2026-01.csv')
    expect(downloaded).toBe('appointments-2026-01.csv')
    expect(click).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
    expect(calls[0].url).toBe('/admin/appointments/export')
    expect(calls[0].responseType).toBe('blob')
    expect(calls[0].params).toEqual({ status: 'booked' })
    expect(calls[0].headers.Authorization).toBe('Bearer tok')
    click.mockRestore()
  })

  it('surfaces JSON error bodies from blob responses', async () => {
    mockHttp(() => ({
      status: 403,
      data: new Blob([JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'No' } })]),
    }))
    await expect(exportAppointments({})).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'No' })
  })

  it('falls back to the default filename', () => {
    expect(filenameFromHeaders({}, 'fallback.csv')).toBe('fallback.csv')
    expect(filenameFromHeaders({ 'content-disposition': "attachment; filename*=UTF-8''a%20b.csv" }, 'x')).toBe('a b.csv')
  })
})

describe('request helpers', () => {
  it('drops empty query params', () => {
    expect(clean({ a: 1, b: '', c: null, d: undefined, e: 0, f: false })).toEqual({ a: 1, e: 0, f: false })
  })

  it('serialises doctor forms as multipart with JSON fields', () => {
    const file = new File(['x'], 'p.png', { type: 'image/png' })
    const form = toDoctorFormData({
      name: 'A',
      about: '',
      fees: 500,
      address: { line1: 'x', line2: '', city: 'y' },
      schedule: { slotMinutes: 30, weekly: [] },
      image: file,
    })
    expect(form.get('name')).toBe('A')
    expect(form.has('about')).toBe(false)
    expect(form.get('fees')).toBe('500')
    expect(JSON.parse(form.get('address'))).toEqual({ line1: 'x', line2: '', city: 'y' })
    expect(JSON.parse(form.get('schedule')).slotMinutes).toBe(30)
    expect(form.get('image').name).toBe('p.png')
  })
})
