import { useEffect, useMemo, useState } from 'react'
import { createDoctor, updateDoctor } from '../../api/doctors'
import { ScheduleFields } from '../../components/schedule/ScheduleEditor'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import { useMutation } from '../../hooks/useFetch'
import { doctorToForm, emptyDoctorForm, formToPayload } from '../../lib/doctorForm'
import { fieldErrors } from '../../lib/errorCodes'
import { toApiSchedule, toFormState, validateSchedule } from '../../lib/schedule'
import { imageProblem, validateDoctor } from '../../lib/validation'

const DEFAULT_SCHEDULE = {
  slotMinutes: 30,
  weekly: [1, 2, 3, 4, 5].map((day) => ({ day, start: '10:00', end: '17:00', breaks: [{ start: '13:00', end: '14:00' }] })),
}

function ImagePicker({ file, current, name, error, onChange }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || 'New doctor'} src={preview ?? current} size="lg" />
      <div>
        <Input
          label="Photo (JPEG, PNG or WebP, up to 2 MB)"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          error={error}
          onChange={(e) => onChange(e.target.files[0] ?? null)}
        />
      </div>
    </div>
  )
}

export default function DoctorForm({ open, doctor, specialities, onClose, onSaved }) {
  const isEdit = Boolean(doctor)
  const [values, setValues] = useState(() => (doctor ? doctorToForm(doctor) : emptyDoctorForm()))
  const [errors, setErrors] = useState({})
  const [withSchedule, setWithSchedule] = useState(false)
  const [schedule, setSchedule] = useState(() => toFormState(DEFAULT_SCHEDULE))
  const save = useMutation((payload) => (isEdit ? updateDoctor(doctor.id, payload) : createDoctor(payload)), {
    success: isEdit ? 'Doctor updated' : 'Doctor created',
  })

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))
  const setAddress = (key) => (e) => setValues((v) => ({ ...v, address: { ...v.address, [key]: e.target.value } }))
  const scheduleErrors = withSchedule ? validateSchedule(schedule) : {}

  const pickImage = (file) => {
    setValues((v) => ({ ...v, image: file }))
    setErrors((e) => ({ ...e, image: imageProblem(file) ?? undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const found = validateDoctor(values, { isEdit })
    setErrors(found)
    if (Object.keys(found).length || Object.keys(scheduleErrors).length) return
    const payload = formToPayload(values, { isEdit, schedule: withSchedule ? toApiSchedule(schedule) : null })
    const result = await save.run(payload)
    if (result.ok) onSaved(result.data)
    else setErrors(fieldErrors(result.error))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Edit ${doctor.name}` : 'Add doctor'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="doctor-form" loading={save.pending}>
            {isEdit ? 'Save changes' : 'Create doctor'}
          </Button>
        </>
      }
    >
      <form id="doctor-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ImagePicker file={values.image} current={doctor?.image} name={values.name} error={errors.image} onChange={pickImage} />
        </div>
        <Input label="Full name" required value={values.name} error={errors.name} onChange={set('name')} />
        <Input label="Email" type="email" required value={values.email} error={errors.email} onChange={set('email')} />
        {!isEdit && (
          <Input
            label="Initial password"
            type="password"
            required
            autoComplete="new-password"
            hint="At least 8 characters with a letter and a digit."
            value={values.password}
            error={errors.password}
            onChange={set('password')}
          />
        )}
        <Select
          label="Speciality"
          required
          placeholder="Select a speciality"
          value={values.speciality}
          error={errors.speciality}
          onChange={set('speciality')}
          options={specialities.map((s) => ({ value: s.slug, label: s.name }))}
        />
        <Input label="Degree" required value={values.degree} error={errors.degree} onChange={set('degree')} />
        <Input label="Experience (years)" required inputMode="numeric" value={values.experienceYears} error={errors.experienceYears} onChange={set('experienceYears')} />
        <Input label="Consultation fees" required inputMode="decimal" value={values.fees} error={errors.fees} onChange={set('fees')} />
        <Textarea wrapperClass="sm:col-span-2" label="About" required value={values.about} error={errors.about} onChange={set('about')} />
        <Input label="Address line 1" required value={values.address.line1} error={errors['address.line1']} onChange={setAddress('line1')} />
        <Input label="Address line 2" value={values.address.line2} onChange={setAddress('line2')} />
        <Input label="City" required value={values.address.city} error={errors['address.city']} onChange={setAddress('city')} />

        {!isEdit && (
          <div className="space-y-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={withSchedule} onChange={(e) => setWithSchedule(e.target.checked)} />
              Set an initial schedule (otherwise Monday to Friday, 10:00 to 17:00 with a lunch break)
            </label>
            {withSchedule && <ScheduleFields state={schedule} onChange={setSchedule} errors={scheduleErrors} />}
          </div>
        )}
      </form>
    </Modal>
  )
}
