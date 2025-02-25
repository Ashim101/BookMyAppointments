export const STORAGE_KEY = 'bma.staff.auth'

const listeners = new Set()

export function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.accessToken && parsed?.refreshToken && parsed?.user ? parsed : null
  } catch {
    return null
  }
}

export function writeSession(tokens) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch {
    // storage unavailable (private mode); the session lives in memory only
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // nothing to clear
  }
}

/** Lets the store learn about token changes made by the HTTP client. */
export function subscribeSession(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const emitSession = (event, tokens) => listeners.forEach((l) => l(event, tokens))
