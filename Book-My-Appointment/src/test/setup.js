import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

window.scrollTo = vi.fn()
window.HTMLElement.prototype.scrollIntoView = vi.fn()

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})
