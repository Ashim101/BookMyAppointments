import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { forgotPassword } from '../api/auth'
import AuthCard from '../components/auth/AuthCard'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAction } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { errorMessage } from '../lib/errors'
import { validateEmail } from '../lib/validation'

export default function ForgotPassword() {
  usePageTitle('Forgot password')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const request = useAction(forgotPassword)

  const submit = async (event) => {
    event.preventDefault()
    const problem = validateEmail(email)
    setError(problem)
    if (problem) return
    try {
      await request.run(email.trim())
      setSent(true)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle="We will email you a link to choose a new one"
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="rounded-lg bg-brand-50 p-4 text-sm text-ink-700">
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. It stays valid for 30 minutes.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" className="w-full" loading={request.loading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
