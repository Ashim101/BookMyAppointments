import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NotificationBell from '../../components/notifications/NotificationBell'
import { page } from '../../test/factories'
import { mockApi, ok } from '../../test/http'
import { renderApp } from '../../test/render'
import { useNotificationPolling } from './useNotificationPolling'

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const note = (id, read = false, extra = {}) => ({
  id,
  type: 'appointment',
  title: `Title ${id}`,
  message: `Message ${id}`,
  link: '/my-appointments',
  read,
  createdAt: new Date().toISOString(),
  ...extra,
})

function Poller() {
  useNotificationPolling()
  return <NotificationBell />
}

const setVisibility = (state) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
})

describe('notification bell', () => {
  it('shows the unread count and lists recent items', async () => {
    const user = userEvent.setup()
    mockApi(() => ok({ ...page([note('n1'), note('n2', true)]), unreadCount: 1 }))
    renderApp(<Poller />)
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    await user.click(bell)
    expect(screen.getByText('Title n1')).toBeInTheDocument()
    expect(screen.getByText('Title n2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View all notifications' })).toHaveAttribute('href', '/notifications')
  })

  it('marks one item as read, lowers the count and follows its link', async () => {
    const user = userEvent.setup()
    const calls = mockApi((config) => (config.method === 'patch' ? ok(note('n1', true)) : ok({ ...page([note('n1')]), unreadCount: 1 })))
    renderApp(<Poller />, { route: '/', path: '/' })
    await user.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    await user.click(screen.getByText('Title n1'))
    expect(await screen.findByText('elsewhere')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'patch').url).toBe('/notifications/n1/read')
  })

  it('marks everything as read', async () => {
    const user = userEvent.setup()
    const calls = mockApi((config) => (config.url === '/notifications/read-all' ? ok({ updated: 2 }) : ok({ ...page([note('n1'), note('n2')]), unreadCount: 2 })))
    renderApp(<Poller />)
    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }))
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
    await screen.findByRole('button', { name: 'Notifications' })
    expect(calls.some((c) => c.url === '/notifications/read-all')).toBe(true)
  })

  it('caps the badge at 99+', async () => {
    mockApi(() => ok({ ...page([note('n1')]), unreadCount: 250 }))
    renderApp(<Poller />)
    expect(await screen.findByText('99+')).toBeInTheDocument()
  })
})

describe('notification polling', () => {
  it('polls every 60 seconds and stops while the tab is hidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const calls = mockApi(() => ok({ ...page([]), unreadCount: 0 }))
    renderApp(<Poller />)
    await act(async () => {})
    expect(calls).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(calls).toHaveLength(2)

    act(() => setVisibility('hidden'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000)
    })
    expect(calls).toHaveLength(2)

    act(() => setVisibility('visible'))
    await act(async () => {})
    expect(calls).toHaveLength(3)
  })

  it('does not poll when logged out', async () => {
    const calls = mockApi(() => ok({ ...page([]), unreadCount: 0 }))
    renderApp(<Poller />, { loggedIn: false })
    await act(async () => {})
    expect(calls).toHaveLength(0)
  })
})
