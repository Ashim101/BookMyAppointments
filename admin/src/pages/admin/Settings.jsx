import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../../api/admin'
import Card from '../../components/Card'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useFetch, useMutation } from '../../hooks/useFetch'
import { fieldErrors } from '../../lib/errorCodes'
import { SLOT_OPTIONS } from '../../lib/schedule'
import { validateSettings } from '../../lib/validation'

const toForm = (s) => ({
  cancellationCutoffHours: String(s.cancellationCutoffHours),
  bookingWindowDays: String(s.bookingWindowDays),
  defaultSlotMinutes: String(s.defaultSlotMinutes),
  currency: s.currency,
})

export default function Settings() {
  const { data, error, loading, reload, setData } = useFetch(getSettings)
  const [values, setValues] = useState(null)
  const [errors, setErrors] = useState({})
  const save = useMutation(saveSettings, { success: 'Settings saved' })

  useEffect(() => {
    if (data) setValues(toForm(data))
  }, [data])

  if (error) return <ErrorState error={error} onRetry={reload} />
  if (loading || !values) return <div className="h-64 animate-pulse rounded-xl bg-slate-100" aria-label="Loading settings" />

  const set = (key) => (e) => setValues({ ...values, [key]: e.target.value })
  const dirty = JSON.stringify(values) !== JSON.stringify(toForm(data))

  const submit = async (event) => {
    event.preventDefault()
    const found = validateSettings(values)
    setErrors(found)
    if (Object.keys(found).length) return
    const result = await save.run({
      cancellationCutoffHours: Number(values.cancellationCutoffHours),
      bookingWindowDays: Number(values.bookingWindowDays),
      defaultSlotMinutes: Number(values.defaultSlotMinutes),
      currency: values.currency,
    })
    if (result.ok) setData(result.data)
    else setErrors(fieldErrors(result.error))
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Clinic-wide booking rules." />
      <Card className="max-w-2xl">
        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Cancellation cutoff (hours)"
            inputMode="numeric"
            hint="Patients cannot cancel or reschedule closer to the start than this."
            value={values.cancellationCutoffHours}
            error={errors.cancellationCutoffHours}
            onChange={set('cancellationCutoffHours')}
          />
          <Input
            label="Booking window (days)"
            inputMode="numeric"
            hint="How far ahead patients can book."
            value={values.bookingWindowDays}
            error={errors.bookingWindowDays}
            onChange={set('bookingWindowDays')}
          />
          <Select
            label="Default slot length"
            value={values.defaultSlotMinutes}
            error={errors.defaultSlotMinutes}
            onChange={set('defaultSlotMinutes')}
            options={SLOT_OPTIONS.map((m) => ({ value: m, label: `${m} minutes` }))}
          />
          <Input
            label="Currency"
            maxLength={3}
            hint="Three-letter ISO code, for example INR."
            value={values.currency}
            error={errors.currency}
            onChange={(e) => setValues({ ...values, currency: e.target.value.toUpperCase() })}
          />
          <Input label="Timezone" value={data.timezone} readOnly disabled hint="Set on the server and cannot be changed here." />
          <div className="flex items-center justify-end gap-3 sm:col-span-2">
            {dirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
            <Button
              variant="secondary"
              disabled={!dirty}
              onClick={() => {
                setValues(toForm(data))
                setErrors({})
              }}
            >
              Reset
            </Button>
            <Button type="submit" loading={save.pending} disabled={!dirty}>
              Save settings
            </Button>
          </div>
        </form>
      </Card>
    </>
  )
}
