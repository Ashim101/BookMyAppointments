import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { makeStore } from '../../src/store'
import { session } from './http'

export const authState = (role) => {
  const s = session({ user: { id: 'u', name: role === 'admin' ? 'Ada Admin' : 'Dr. Who', email: 'x@y.io', role, image: null } })
  return { user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }
}

/** Renders with Redux and a memory router. Pass `role` to start signed in. */
export function renderWithProviders(ui, { role, route = '/', store } = {}) {
  const theStore = store ?? makeStore(role ? { auth: authState(role) } : undefined)
  const result = render(
    <Provider store={theStore}>
      <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>
    </Provider>,
  )
  return { store: theStore, ...result }
}
