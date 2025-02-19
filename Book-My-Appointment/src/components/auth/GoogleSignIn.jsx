import { GoogleLogin } from '@react-oauth/google'
import { useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { signInWithGoogle } from '../../features/auth/authSlice'
import { GOOGLE_CLIENT_ID } from '../../lib/config'
import { errorMessage } from '../../lib/errors'

export default function GoogleSignIn({ onSuccess }) {
  const dispatch = useDispatch()
  if (!GOOGLE_CLIENT_ID) return null

  const handle = async ({ credential }) => {
    const result = await dispatch(signInWithGoogle(credential))
    if (result.error) toast.error(errorMessage(result.error))
    else onSuccess()
  }

  return (
    <div className="mt-6">
      <div className="relative mb-4 text-center text-xs uppercase text-ink-500">
        <span className="relative z-10 bg-white px-2">or</span>
        <span className="absolute inset-x-0 top-1/2 border-t border-slate-200" aria-hidden="true" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin onSuccess={handle} onError={() => toast.error('Google sign-in was cancelled or failed.')} text="continue_with" />
      </div>
    </div>
  )
}
