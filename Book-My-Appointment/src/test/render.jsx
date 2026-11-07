import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { createStore } from '../store'
import { session } from './factories'

function LocationProbe() {
  const { pathname, search, state } = useLocation()
  return <output data-testid="location" data-state={JSON.stringify(state)}>{`${pathname}${search}`}</output>
}

/** Renders `ui` inside a fresh store and a memory router. Pass `loggedIn: false` for an anonymous visitor. */
export function renderApp(ui, { route = '/', path = '*', loggedIn = true } = {}) {
  const store = createStore(loggedIn ? { auth: { tokens: session } } : undefined)
  const result = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<span>elsewhere</span>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </Provider>,
  )
  return { store, ...result }
}

export const currentLocation = (screen) => screen.getByTestId('location').textContent
