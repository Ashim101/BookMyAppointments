import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { homePath, signIn } from '../features/auth/authSlice'
import { messageFor } from '../lib/errorCodes'
import { isEmail } from '../lib/validation'
import AuthShell from './AuthShell'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'doctor', label: 'Doctor' },
]

export default function Login() {
  const [role, setRole] = useState('admin')
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [pending, setPending] = useState(false)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const submit = async (event) => {
    event.preventDefault()
    const next = {}
    if (!isEmail(form.email)) next.email = 'Enter a valid email address'
    if (!form.password) next.password = 'Enter your password'
    setErrors(next)
    setFailure('')
    if (Object.keys(next).length) return

    setPending(true)
    const result = await dispatch(signIn({ ...form, role }))
    setPending(false)
    if (signIn.fulfilled.match(result)) {
      const from = location.state?.from
      const home = homePath(result.payload.user.role)
      navigate(from?.startsWith(home) ? from : home, { replace: true })
    } else {
      setFailure(messageFor(result.payload))
    }
  }

  return (
    <AuthShell
      title="Sign in to the staff console"
      subtitle="Choose your role and use your work credentials."
      footer={
        role === 'doctor' && (
          <Link to="/forgot-password" className="font-medium text-brand-700 hover:underline">
            Forgot your password?
          </Link>
        )
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <div role="radiogroup" aria-label="Sign in as" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={role === r.value}
              onClick={() => setRole(r.value)}
              className={`rounded-md py-1.5 text-sm font-medium transition ${
                role === r.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {failure && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {failure}
          </p>
        )}
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          value={form.email}
          error={errors.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button type="submit" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
