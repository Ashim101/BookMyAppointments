import { configureStore } from '@reduxjs/toolkit'
import authReducer, { sessionCleared, tokensRefreshed } from './features/auth/authSlice'
import { subscribeSession } from './api/session'

export const makeStore = (preloadedState) =>
  configureStore({ reducer: { auth: authReducer }, preloadedState })

/** Mirrors token changes made by the HTTP client (refresh, forced logout) into the store. */
export function bindSession(store) {
  return subscribeSession((event, tokens) => {
    store.dispatch(event === 'refresh' ? tokensRefreshed(tokens) : sessionCleared())
  })
}

export const store = makeStore()
