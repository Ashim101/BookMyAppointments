import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { messageFor } from '../lib/errorCodes'
import { isEmail } from '../lib/validation'
import AuthShell from './AuthShell'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!isEmail(email)) {
      setError('Enter a valid email address')
      return
    }
    setError('')
    setPending(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (e) {
      setError(messageFor(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Doctors only. Administrators manage their password through server configuration."
      footer={<Link to="/login" className="font-medium text-brand-700 hover:underline">Back to sign in</Link>}
    >
      {sent ? (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          If an account exists for {email}, a reset link is on its way. The link is valid for 30 minutes.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          <Input label="Email" type="email" autoComplete="email" value={email} error={error} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={pending} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
