import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { updateProfile } from '../../api/patient'
import { updateUser } from '../../features/auth/authSlice'
import { useAction } from '../../hooks/useQuery'
import { errorMessage, fieldErrors } from '../../lib/errors'
import { GENDERS, validateProfile } from '../../lib/validation'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import ImageUpload from './ImageUpload'

const GENDER_OPTIONS = GENDERS.map((value) => ({ value, label: value === 'unspecified' ? 'Prefer not to say' : value[0].toUpperCase() + value.slice(1) }))

const toValues = (patient) => ({
  name: patient.name,
  phone: patient.phone || '',
  gender: patient.gender || 'unspecified',
  dob: patient.dob || '',
  address: { line1: patient.address?.line1 || '', line2: patient.address?.line2 || '', city: patient.address?.city || '' },
})

export default function ProfileForm({ patient, onSaved }) {
  const [values, setValues] = useState(() => toValues(patient))
  const [image, setImage] = useState(null)
  const [imageError, setImageError] = useState('')
  const [errors, setErrors] = useState({})
  const save = useAction(updateProfile)
  const dispatch = useDispatch()

  const set = (field) => (event) => setValues((v) => ({ ...v, [field]: event.target.value }))
  const setAddress = (field) => (event) => setValues((v) => ({ ...v, address: { ...v.address, [field]: event.target.value } }))
  const err = (field) => errors[field] || errors[`address.${field}`]

  const submit = async (event) => {
    event.preventDefault()
    const found = validateProfile(values)
    setErrors(found)
    if (Object.keys(found).length > 0 || imageError) return
    try {
      const saved = await save.run({ ...values, name: values.name.trim(), phone: values.phone.trim(), image })
      dispatch(updateUser({ name: saved.name, image: saved.image }))
      setImage(null)
      setValues(toValues(saved))
      toast.success('Profile updated.')
      onSaved?.(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-6" noValidate aria-label="Profile">
      <ImageUpload
        name={values.name}
        currentSrc={patient.image}
        file={image}
        onChange={setImage}
        error={imageError}
        onError={setImageError}
      />
      <Input label="Full name" autoComplete="name" value={values.name} onChange={set('name')} error={err('name')} />
      <Input label="Email" type="email" value={patient.email} disabled readOnly hint="Your email is used to sign in and cannot be changed here." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Phone" type="tel" autoComplete="tel" value={values.phone} onChange={set('phone')} error={err('phone')} />
        <Select label="Gender" value={values.gender} onChange={set('gender')} options={GENDER_OPTIONS} error={err('gender')} />
      </div>
      <Input label="Date of birth" type="date" autoComplete="bday" value={values.dob} onChange={set('dob')} error={err('dob')} />
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-ink-900">Address</legend>
        <Input label="Address line 1" autoComplete="address-line1" value={values.address.line1} onChange={setAddress('line1')} error={err('line1')} />
        <Input label="Address line 2" autoComplete="address-line2" value={values.address.line2} onChange={setAddress('line2')} error={err('line2')} />
        <Input label="City" autoComplete="address-level2" value={values.address.city} onChange={setAddress('city')} error={err('city')} />
      </fieldset>
      <Button type="submit" loading={save.loading}>
        Save changes
      </Button>
    </form>
  )
}
