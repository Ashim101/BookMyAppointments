import { AUTH_STORAGE_KEY } from './config'

export function loadTokens() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.accessToken && parsed?.refreshToken && parsed?.user ? parsed : null
  } catch {
    return null
  }
}

export function saveTokens(tokens) {
  try {
    if (tokens) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens))
    else localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private mode); the session then lasts for this tab only.
  }
}
