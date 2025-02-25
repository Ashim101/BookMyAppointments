import { useEffect, useState } from 'react'
import { getProfile, updateProfile } from '../../api/doctorSelf'
import Card from '../../components/Card'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Toggle from '../../components/ui/Toggle'
import { useFetch, useMutation } from '../../hooks/useFetch'
import { fieldErrors } from '../../lib/errorCodes'
import { formatCurrency } from '../../lib/format'

const toForm = (p) => ({
  about: p.about,
  fees: String(p.fees),
  available: p.available,
  address: { line1: p.address.line1, line2: p.address.line2 ?? '', city: p.address.city },
})

function validate(values) {
  const errors = {}
  if (!values.about.trim()) errors.about = 'Add a short description'
  if (values.fees === '' || Number.isNaN(Number(values.fees)) || Number(values.fees) < 0) errors.fees = 'Fees must be a positive number'
  if (!values.address.line1.trim()) errors['address.line1'] = 'Address line 1 is required'
  if (!values.address.city.trim()) errors['address.city'] = 'City is required'
  return errors
}

export default function Profile() {
  const { data, loading, error, reload, setData } = useFetch(getProfile)
  const [values, setValues] = useState(null)
  const [errors, setErrors] = useState({})
  const save = useMutation(updateProfile, { success: 'Profile saved' })

  useEffect(() => {
    if (data) setValues(toForm(data))
  }, [data])

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading || !values) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" aria-label="Loading profile" />

  const setAddress = (key) => (e) => setValues({ ...values, address: { ...values.address, [key]: e.target.value } })

  const submit = async (event) => {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length) return
    const result = await save.run({
      about: values.about.trim(),
      fees: Number(values.fees),
      available: values.available,
      address: { line1: values.address.line1.trim(), line2: values.address.line2.trim(), city: values.address.city.trim() },
    })
    if (result.ok) setData(result.data)
    else setErrors(fieldErrors(result.error))
  }

  return (
    <>
      <PageHeader title="Profile" subtitle="What patients see about you. Name, speciality and credentials are managed by an administrator." />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-[18rem_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar name={data.name} src={data.image} size="lg" />
            <p className="font-semibold text-slate-900">{data.name}</p>
            <p className="text-sm text-slate-500">{data.specialityName}</p>
            <p className="text-xs text-slate-500">{data.degree}, {data.experienceYears} years</p>
            <p className="text-sm text-slate-700">{formatCurrency(data.fees, data.currency)} per visit</p>
            <p className="text-xs text-slate-500">{data.rating.count ? `${data.rating.average} / 5 from ${data.rating.count} reviews` : 'No reviews yet'}</p>
          </div>
        </Card>
        <Card>
          <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 sm:col-span-2">
              <Toggle checked={values.available} onChange={(available) => setValues({ ...values, available })} label="Accepting bookings" />
              <span className="text-sm text-slate-700">{values.available ? 'Accepting new bookings' : 'Not accepting new bookings'}</span>
            </div>
            <Textarea wrapperClass="sm:col-span-2" label="About" rows={5} value={values.about} error={errors.about} onChange={(e) => setValues({ ...values, about: e.target.value })} />
            <Input label="Consultation fees" inputMode="decimal" value={values.fees} error={errors.fees} onChange={(e) => setValues({ ...values, fees: e.target.value })} />
            <div className="hidden sm:block" />
            <Input label="Address line 1" value={values.address.line1} error={errors['address.line1']} onChange={setAddress('line1')} />
            <Input label="Address line 2" value={values.address.line2} onChange={setAddress('line2')} />
            <Input label="City" value={values.address.city} error={errors['address.city']} onChange={setAddress('city')} />
            <div className="flex items-end justify-end sm:col-span-2">
              <Button type="submit" loading={save.pending}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  )
}
