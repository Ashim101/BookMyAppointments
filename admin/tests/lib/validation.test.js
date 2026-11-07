import { doctorToForm, emptyDoctorForm, formToPayload } from '../../src/lib/doctorForm'
import {
  IMAGE_MAX_BYTES, imageProblem, isEmail, passwordProblem, validateDoctor, validatePrescriptionRow, validateSettings,
} from '../../src/lib/validation'
import { emptyRow, hasRowErrors, moveRow, toPrescription, validateRows } from '../../src/lib/prescription'
import { doctor } from '../helpers/fixtures'

const valid = () => ({
  ...emptyDoctorForm(),
  name: 'Dr. Asha Rao',
  email: 'asha@example.com',
  password: 'pass1234',
  speciality: 'cardiology',
  degree: 'MD',
  experienceYears: '8',
  about: 'Heart specialist',
  fees: '800',
  address: { line1: '1 Road', line2: '', city: 'Pune' },
})

const file = (type, size = 10) => ({ type, size, name: 'x' })

describe('validateDoctor', () => {
  it('accepts a complete form', () => {
    expect(validateDoctor(valid())).toEqual({})
  })

  it('requires the basic fields', () => {
    const errors = validateDoctor(emptyDoctorForm())
    expect(Object.keys(errors).sort()).toEqual(
      ['about', 'address.city', 'address.line1', 'degree', 'email', 'experienceYears', 'fees', 'name', 'password', 'speciality'].sort(),
    )
  })

  it('validates experience as a whole number from 0 to 60', () => {
    for (const bad of ['-1', '61', '2.5', 'abc', '']) {
      expect(validateDoctor({ ...valid(), experienceYears: bad }).experienceYears).toBeDefined()
    }
    for (const good of ['0', '60', '12']) {
      expect(validateDoctor({ ...valid(), experienceYears: good }).experienceYears).toBeUndefined()
    }
  })

  it('validates fees as a non-negative number within range', () => {
    for (const bad of ['-5', 'free', '', '1000001']) {
      expect(validateDoctor({ ...valid(), fees: bad }).fees).toBeDefined()
    }
    expect(validateDoctor({ ...valid(), fees: '499.50' }).fees).toBeUndefined()
    expect(validateDoctor({ ...valid(), fees: '0' }).fees).toBeUndefined()
  })

  it('does not require a password when editing', () => {
    expect(validateDoctor({ ...valid(), password: '' }, { isEdit: true })).toEqual({})
  })

  it('checks the image type and size', () => {
    expect(validateDoctor({ ...valid(), image: file('image/gif') }).image).toMatch(/JPEG, PNG or WebP/)
    expect(validateDoctor({ ...valid(), image: file('image/png', IMAGE_MAX_BYTES + 1) }).image).toMatch(/2 MB/)
    expect(validateDoctor({ ...valid(), image: file('image/webp', IMAGE_MAX_BYTES) }).image).toBeUndefined()
  })
})

describe('field validators', () => {
  it('checks emails and passwords', () => {
    expect(isEmail('a@b.io')).toBe(true)
    expect(isEmail('a@b')).toBe(false)
    expect(passwordProblem('short1')).toMatch(/8 characters/)
    expect(passwordProblem('allletters')).toMatch(/letter and one digit/)
    expect(passwordProblem('12345678')).toMatch(/letter and one digit/)
    expect(passwordProblem('abc12345')).toBeNull()
    expect(imageProblem(null)).toBeNull()
  })

  it('validates settings', () => {
    const good = { cancellationCutoffHours: '24', bookingWindowDays: '30', defaultSlotMinutes: '30', currency: 'INR' }
    expect(validateSettings(good)).toEqual({})
    const errors = validateSettings({ cancellationCutoffHours: '-1', bookingWindowDays: '0', defaultSlotMinutes: '25', currency: 'rs' })
    expect(Object.keys(errors)).toHaveLength(4)
    expect(validateSettings({ ...good, bookingWindowDays: '366' }).bookingWindowDays).toBeDefined()
    expect(validateSettings({ ...good, cancellationCutoffHours: '1.5' }).cancellationCutoffHours).toBeDefined()
  })
})

describe('doctor form mapping', () => {
  it('round-trips an existing doctor', () => {
    const form = doctorToForm(doctor())
    expect(form.fees).toBe('800')
    expect(form.password).toBe('')
    const payload = formToPayload(form, { isEdit: true })
    expect(payload).toMatchObject({ name: 'Dr. Asha Rao', fees: 800, experienceYears: 8, email: 'asha@example.com' })
    expect(payload.password).toBeUndefined()
  })

  it('includes password and schedule only for new doctors', () => {
    const schedule = { slotMinutes: 30, weekly: [] }
    const payload = formToPayload({ ...valid(), email: ' ASHA@Example.com ' }, { isEdit: false, schedule })
    expect(payload).toMatchObject({ password: 'pass1234', schedule, email: 'asha@example.com' })
    expect(formToPayload(valid(), { isEdit: false, schedule: null }).schedule).toBeUndefined()
  })
})

describe('prescription helpers', () => {
  const row = (o = {}) => ({ ...emptyRow(), medicine: 'Paracetamol', dosage: '500 mg', frequency: 'Twice a day', durationDays: '5', ...o })

  it('validates required fields and the duration range', () => {
    expect(validatePrescriptionRow(row())).toEqual({})
    expect(Object.keys(validatePrescriptionRow(emptyRow()))).toEqual(['medicine', 'dosage', 'frequency', 'durationDays'])
    expect(validatePrescriptionRow(row({ durationDays: '0' })).durationDays).toBeDefined()
    expect(validatePrescriptionRow(row({ durationDays: '366' })).durationDays).toBeDefined()
    expect(validatePrescriptionRow(row({ durationDays: '1.5' })).durationDays).toBeDefined()
    expect(hasRowErrors(validateRows([row(), emptyRow()]))).toBe(true)
    expect(hasRowErrors(validateRows([row()]))).toBe(false)
  })

  it('moves rows and ignores out-of-range moves', () => {
    const rows = [row({ medicine: 'A' }), row({ medicine: 'B' }), row({ medicine: 'C' })]
    expect(moveRow(rows, 2, -1).map((r) => r.medicine)).toEqual(['A', 'C', 'B'])
    expect(moveRow(rows, 0, 1).map((r) => r.medicine)).toEqual(['B', 'A', 'C'])
    expect(moveRow(rows, 0, -1)).toBe(rows)
    expect(moveRow(rows, 2, 1)).toBe(rows)
  })

  it('converts rows to the API shape', () => {
    expect(toPrescription([row({ medicine: ' Ibuprofen ', instructions: ' after food ' })])).toEqual([
      { medicine: 'Ibuprofen', dosage: '500 mg', frequency: 'Twice a day', durationDays: 5, instructions: 'after food' },
    ])
  })

  it('gives every new row a unique key', () => {
    expect(emptyRow().key).not.toBe(emptyRow().key)
  })
})
