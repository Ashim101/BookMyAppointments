import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { resetPassword } from '../api/auth'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { messageFor } from '../lib/errorCodes'
import { passwordProblem } from '../lib/validation'
import AuthShell from './AuthShell'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const validLink = Boolean(token) && params.get('role') === 'doctor'
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    const problem = passwordProblem(form.password)
    if (problem) next.password = problem
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match'
    setErrors(next)
    if (Object.keys(next).length) return

    setPending(true)
    setFailure('')
    try {
      await resetPassword(token, form.password)
      toast.success('Password updated. Please sign in.')
      navigate('/login', { replace: true })
    } catch (e) {
      setFailure(messageFor(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      footer={<Link to="/login" className="font-medium text-brand-700 hover:underline">Back to sign in</Link>}
    >
      {!validLink ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          This reset link is invalid. Request a new one from the{' '}
          <Link to="/forgot-password" className="font-medium underline">forgot password</Link> page.
        </p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {failure && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {failure}
            </p>
          )}
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters with a letter and a digit."
            value={form.password}
            error={errors.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            error={errors.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          />
          <Button type="submit" loading={pending} className="w-full">
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
