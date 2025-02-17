import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { requestOtp } from '../api/auth'
import AuthCard from '../components/auth/AuthCard'
import GoogleSignIn from '../components/auth/GoogleSignIn'
import OtpInput from '../components/auth/OtpInput'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { selectIsAuthenticated, signUp } from '../features/auth/authSlice'
import { useCountdown } from '../hooks/useCountdown'
import { useAction } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { errorMessage, fieldErrors } from '../lib/errors'
import { validateOtp, validateRegistration } from '../lib/validation'

export default function Register() {
  usePageTitle('Create account')
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState('details')
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [seconds, restartCountdown] = useCountdown(0)
  const sendCode = useAction(requestOtp)
  const authenticated = useSelector(selectIsAuthenticated)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const destination = useLocation().state?.from || '/'

  if (authenticated) return <Navigate to={destination} replace />

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }))

  const requestCode = async () => {
    try {
      const { resendAfterSeconds } = await sendCode.run(values.email.trim())
      restartCountdown(resendAfterSeconds)
      setOtp('')
      setOtpError('')
      setStep('otp')
      toast.info(`We sent a 6-digit code to ${values.email.trim()}.`)
      return true
    } catch (error) {
      if (error.code === 'OTP_COOLDOWN') restartCountdown(60)
      setErrors(error.code === 'EMAIL_TAKEN' ? { email: errorMessage(error) } : fieldErrors(error))
      toast.error(errorMessage(error))
      return false
    }
  }

  const submitDetails = async (event) => {
    event.preventDefault()
    const found = validateRegistration(values)
    setErrors(found)
    if (Object.keys(found).length === 0) await requestCode()
  }

  const submitOtp = async (event) => {
    event.preventDefault()
    const problem = validateOtp(otp)
    setOtpError(problem)
    if (problem) return
    setSubmitting(true)
    const result = await dispatch(
      signUp({ name: values.name.trim(), email: values.email.trim(), password: values.password, otp }),
    )
    setSubmitting(false)
    if (!result.error) {
      toast.success('Welcome aboard! Your account is ready.')
      navigate(destination, { replace: true })
      return
    }
    const { code } = result.error
    toast.error(errorMessage(result.error))
    if (code === 'OTP_INVALID' || code === 'OTP_EXPIRED') {
      setOtp('')
      setOtpError(errorMessage(result.error))
    } else if (code === 'EMAIL_TAKEN' || code === 'VALIDATION_ERROR') {
      setErrors(code === 'EMAIL_TAKEN' ? { email: errorMessage(result.error) } : fieldErrors(result.error))
      setStep('details')
    }
  }

  return (
    <AuthCard
      title={step === 'details' ? 'Create your account' : 'Verify your email'}
      subtitle={step === 'details' ? 'Book and manage visits in minutes' : `Enter the code we sent to ${values.email.trim()}`}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={{ from: destination }} className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {step === 'details' ? (
        <>
          <form onSubmit={submitDetails} className="space-y-4" noValidate>
            <Input label="Full name" autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
            <Input label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={set('password')}
              error={errors.password}
              hint="At least 8 characters, with a letter and a digit."
            />
            <Button type="submit" className="w-full" loading={sendCode.loading}>
              Send verification code
            </Button>
          </form>
          <GoogleSignIn onSuccess={() => navigate(destination, { replace: true })} />
        </>
      ) : (
        <form onSubmit={submitOtp} className="space-y-5" noValidate>
          <OtpInput value={otp} onChange={setOtp} error={otpError} disabled={submitting} />
          <Button type="submit" className="w-full" loading={submitting}>
            Create account
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" className="font-medium text-ink-500 hover:underline" onClick={() => setStep('details')}>
              Change email
            </button>
            <button
              type="button"
              onClick={requestCode}
              disabled={seconds > 0 || sendCode.loading}
              className="font-semibold text-brand-700 hover:underline disabled:text-ink-300 disabled:no-underline"
            >
              {seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  )
}
