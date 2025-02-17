import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import AuthCard from '../components/auth/AuthCard'
import GoogleSignIn from '../components/auth/GoogleSignIn'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { selectIsAuthenticated, signIn } from '../features/auth/authSlice'
import { usePageTitle } from '../hooks/usePageTitle'
import { errorMessage, fieldErrors } from '../lib/errors'
import { validateLogin } from '../lib/validation'

export default function Login() {
  usePageTitle('Sign in')
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const authenticated = useSelector(selectIsAuthenticated)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const destination = useLocation().state?.from || '/'

  if (authenticated) return <Navigate to={destination} replace />

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const found = validateLogin(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSubmitting(true)
    const result = await dispatch(signIn({ email: values.email.trim(), password: values.password }))
    setSubmitting(false)
    if (result.error) {
      setErrors(fieldErrors(result.error))
      toast.error(errorMessage(result.error))
    } else {
      navigate(destination, { replace: true })
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to manage your appointments"
      footer={
        <>
          New here?{' '}
          <Link to="/register" state={{ from: destination }} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
        />
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>
      <GoogleSignIn onSuccess={() => navigate(destination, { replace: true })} />
    </AuthCard>
  )
}
