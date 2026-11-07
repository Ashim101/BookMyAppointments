import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import NotificationBell, { POLL_INTERVAL_MS } from '../../src/components/NotificationBell'
import { mockApi, ok } from '../helpers/http'
import { paginated } from '../helpers/fixtures'
import { renderWithProviders } from '../helpers/render'

const note = (o) => ({ id: 'n1', type: 'booking', title: 'New booking', message: 'Pat booked 10:00', link: '/doctor/appointments', read: false, createdAt: '2026-11-07T10:00:00Z', ...o })
const list = (items, unreadCount) => ok({ ...paginated(items), unreadCount })

describe('NotificationBell', () => {
  it('shows the unread count and lists notifications', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /notifications': list([note(), note({ id: 'n2', title: 'Reminder', read: true })], 1) })
    renderWithProviders(<NotificationBell />)
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    await user.click(bell)
    expect(screen.getByText('New booking')).toBeInTheDocument()
    expect(screen.getByText('Reminder')).toBeInTheDocument()
  })

  it('marks one notification read and follows its link', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /notifications': list([note()], 1), 'PATCH /notifications/:id/read': ok(note({ read: true })) })
    renderWithProviders(
      <Routes>
        <Route path="/" element={<NotificationBell />} />
        <Route path="/doctor/appointments" element={<h1>Appointments page</h1>} />
      </Routes>,
    )
    await user.click(await screen.findByRole('button', { name: /Notifications, 1 unread/ }))
    await user.click(screen.getByText('New booking'))
    expect(await screen.findByRole('heading', { name: 'Appointments page' })).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'patch').url).toBe('/notifications/n1/read')
  })

  it('marks everything as read', async () => {
    const user = userEvent.setup()
    const calls = mockApi({ 'GET /notifications': list([note(), note({ id: 'n2' })], 2), 'PATCH /notifications/read-all': ok({ updated: 2 }) })
    renderWithProviders(<NotificationBell />)
    await user.click(await screen.findByRole('button', { name: /2 unread/ }))
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument())
    expect(calls.some((c) => c.url === '/notifications/read-all')).toBe(true)
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
  })

  it('shows an empty state and closes on Escape', async () => {
    const user = userEvent.setup()
    mockApi({ 'GET /notifications': list([], 0) })
    renderWithProviders(<NotificationBell />)
    await user.click(await screen.findByRole('button', { name: 'Notifications' }))
    expect(screen.getByText('You are all caught up.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByText('You are all caught up.')).not.toBeInTheDocument()
  })

  describe('polling', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
    afterEach(() => vi.useRealTimers())

    const visibility = (state) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    const fetches = (calls) => calls.filter((c) => c.url === '/notifications').length

    it('refreshes every 60 seconds while visible and pauses while hidden', async () => {
      const calls = mockApi({ 'GET /notifications': list([], 0) })
      renderWithProviders(<NotificationBell />)
      await waitFor(() => expect(fetches(calls)).toBe(1))

      await act(async () => vi.advanceTimersByTime(POLL_INTERVAL_MS))
      await waitFor(() => expect(fetches(calls)).toBe(2))

      act(() => visibility('hidden'))
      await act(async () => vi.advanceTimersByTime(POLL_INTERVAL_MS * 3))
      expect(fetches(calls)).toBe(2)

      act(() => visibility('visible'))
      await waitFor(() => expect(fetches(calls)).toBe(3))
      await act(async () => vi.advanceTimersByTime(POLL_INTERVAL_MS))
      await waitFor(() => expect(fetches(calls)).toBe(4))
    })

    it('picks up new unread notifications from a poll', async () => {
      let unread = 0
      mockApi({ 'GET /notifications': () => list([], unread) })
      renderWithProviders(<NotificationBell />)
      await screen.findByRole('button', { name: 'Notifications' })
      unread = 3
      await act(async () => vi.advanceTimersByTime(POLL_INTERVAL_MS))
      expect(await screen.findByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument()
    })
  })
})
