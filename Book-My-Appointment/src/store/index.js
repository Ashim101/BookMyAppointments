import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { configureClient } from '../api/client'
import authReducer, { clearSession, selectTokens, setSession, updateUser } from '../features/auth/authSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'
import { saveTokens } from '../lib/tokenStorage'

export function createStore(preloadedState) {
  const persistence = createListenerMiddleware()
  persistence.startListening({
    matcher: isAnyOf(setSession, updateUser, clearSession),
    effect: (_, api) => saveTokens(selectTokens(api.getState())),
  })

  return configureStore({
    reducer: { auth: authReducer, notifications: notificationsReducer },
    preloadedState,
    middleware: (getDefault) => getDefault().prepend(persistence.middleware),
  })
}

export function connectApiClient(store, redirect = (path) => window.location.assign(path)) {
  configureClient({
    getTokens: () => selectTokens(store.getState()),
    onTokens: (tokens) => store.dispatch(setSession(tokens)),
    onLogout: () => {
      store.dispatch(clearSession())
      redirect('/login')
    },
  })
}
