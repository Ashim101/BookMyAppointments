const env = import.meta.env

export const API_URL = (env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')
export const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID || ''
export const AUTH_STORAGE_KEY = 'bma.patient.auth'
export const BRAND = 'BookMyAppointments'
export const SUPPORT_EMAIL = 'support@example.com'
export const SUPPORT_PHONE = '+00 000 000 0000'
export const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'
export const NOTIFICATION_POLL_MS = 60_000
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
