import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ErrorBoundary from '../components/layout/ErrorBoundary'
import { makeAppointment, makeDoctor, page, session } from '../test/factories'
import { fail, mockApi, ok } from '../test/http'
import { createStore } from '../store'
import AppRoutes from './AppRoutes'

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

function visit(route, { loggedIn = false } = {}) {
  const store = createStore(loggedIn ? { auth: { tokens: session } } : undefined)
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <AppRoutes />
      </MemoryRouter>
    </Provider>,
  )
  return store
}

const baseApi = (config) => {
  if (config.url === '/specialities') return ok([{ id: 's1', slug: 'cardiologist', name: 'Cardiologist', description: '', doctorCount: 3 }])
  if (config.url === '/doctors') return ok(page([makeDoctor()]))
  if (config.url === '/notifications') return ok({ ...page([]), unreadCount: 0 })
  return fail(404, 'NOT_FOUND')
}

describe('routing', () => {
  it('renders the home page with specialities and top doctors from the API', async () => {
    const calls = mockApi(baseApi)
    visit('/')
    expect(await screen.findByRole('link', { name: /Cardiologist/ })).toHaveAttribute('href', '/doctors?speciality=cardiologist')
    expect(await screen.findByText('Dr. Priya Nair')).toBeInTheDocument()
    expect(calls.find((c) => c.url === '/doctors').params).toEqual({ sort: 'rating', limit: 8 })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Care that fits your calendar')
  })

  it('shows sign in links to visitors and the user menu to members', async () => {
    mockApi(baseApi)
    visit('/about')
    expect(await screen.findByRole('heading', { name: /About BookMyAppointments/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Sign in' }).length).toBeGreaterThan(0)
  })

  it('shows the signed-in user and logs out through the API', async () => {
    const user = userEvent.setup()
    const calls = mockApi(baseApi)
    const store = visit('/about', { loggedIn: true })
    await user.click(await screen.findByRole('button', { name: /Asha Kumar/ }))
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(store.getState().auth.tokens).toBeNull())
    expect(calls.some((c) => c.url === '/auth/logout')).toBe(true)
  })

  it('redirects anonymous visitors from protected pages to login', async () => {
    mockApi(baseApi)
    visit('/my-appointments?tab=past')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('lets signed-in members open protected pages', async () => {
    mockApi((config) => (config.url === '/appointments' ? ok(page([])) : baseApi(config)))
    visit('/my-appointments', { loggedIn: true })
    expect(await screen.findByRole('heading', { name: 'My appointments' })).toBeInTheDocument()
  })

  it('renders a 404 page for unknown routes', async () => {
    mockApi(baseApi)
    visit('/nope/nothing')
    expect(await screen.findByRole('heading', { name: /could not find that page/ })).toBeInTheDocument()
  })

  it('exposes a skip link and a main landmark', async () => {
    mockApi(baseApi)
    visit('/contact')
    expect(await screen.findByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('shows consultation notes and the prescription on the appointment page', async () => {
    const completed = makeAppointment({
      status: 'completed',
      paymentStatus: 'paid',
      consultation: {
        notes: 'Blood pressure is normal.',
        prescription: [{ medicine: 'Aspirin', dosage: '75 mg', frequency: 'Once daily', durationDays: 30, instructions: 'After food' }],
        completedAt: '2026-12-10T06:00:00.000Z',
      },
    })
    mockApi((config) => (config.url === '/appointments/a1' ? ok(completed) : baseApi(config)))
    visit('/my-appointments/a1', { loggedIn: true })
    expect(await screen.findByText('Blood pressure is normal.')).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Aspirin' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Print or save as PDF/ })).toBeInTheDocument()
  })

  it('catches render errors with the error boundary', () => {
    const Boom = () => {
      throw new Error('boom')
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    spy.mockRestore()
  })
})
