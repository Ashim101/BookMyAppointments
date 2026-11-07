import { RAZORPAY_SCRIPT_URL } from './config'

let pending = null

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay)
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = RAZORPAY_SCRIPT_URL
      script.async = true
      script.onload = () => resolve(window.Razorpay)
      script.onerror = () => {
        pending = null
        script.remove()
        reject(new Error('Could not load the payment provider. Check your connection and try again.'))
      }
      document.body.appendChild(script)
    })
  }
  return pending
}
