import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { resetPassword } from '../api/auth'
import AuthCard from '../components/auth/AuthCard'
import Button, { ButtonLink } from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAction } from '../hooks/useQuery'
import { usePageTitle } from '../hooks/usePageTitle'
import { errorMessage, fieldErrors } from '../lib/errors'
import { validateReset } from '../lib/validation'

export default function ResetPassword() {
  usePageTitle('Choose a new password')
  const [params] = useSearchParams()
  const token = params.get('token')
  const role = params.get('role')
  const [values, setValues] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const reset = useAction(resetPassword)
  const navigate = useNavigate()

  if (!token || (role && role !== 'patient')) {
    return (
      <AuthCard title="This link is not valid" subtitle="The reset link is incomplete or meant for a different account type.">
        <ButtonLink to="/forgot-password" className="w-full">
          Request a new link
        </ButtonLink>
      </AuthCard>
    )
  }

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const found = validateReset(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    try {
      await reset.run({ token, password: values.password })
      toast.success('Password updated. Please sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error, 'This reset link has expired or was already used. Please request a new one.'))
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint="At least 8 characters, with a letter and a digit."
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />
        <Button type="submit" className="w-full" loading={reset.loading}>
          Update password
        </Button>
      </form>
    </AuthCard>
  )
}
