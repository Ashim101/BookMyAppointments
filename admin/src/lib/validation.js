export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value ?? '')

/** Same password policy as registration: 8+ characters with a letter and a digit. */
export function passwordProblem(value) {
  if (!value || value.length < 8) return 'Use at least 8 characters'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Include at least one letter and one digit'
  return null
}

export function imageProblem(file) {
  if (!file) return null
  if (!IMAGE_TYPES.includes(file.type)) return 'Image must be a JPEG, PNG or WebP file'
  if (file.size > IMAGE_MAX_BYTES) return 'Image must be 2 MB or smaller'
  return null
}

const isWholeNumber = (v) => v !== '' && Number.isInteger(Number(v))

/** Validates the admin doctor form. Returns `{ field: message }`, empty when valid. */
export function validateDoctor(values, { isEdit = false } = {}) {
  const errors = {}
  const name = values.name?.trim() ?? ''
  if (name.length < 2) errors.name = 'Enter the doctor’s full name'
  if (!isEmail(values.email)) errors.email = 'Enter a valid email address'
  if (!isEdit) {
    const problem = passwordProblem(values.password)
    if (problem) errors.password = problem
  }
  if (!values.speciality) errors.speciality = 'Choose a speciality'
  if (!values.degree?.trim()) errors.degree = 'Enter the degree'
  if (!isWholeNumber(values.experienceYears) || Number(values.experienceYears) < 0 || Number(values.experienceYears) > 60) {
    errors.experienceYears = 'Experience must be a whole number between 0 and 60'
  }
  if (values.fees === '' || Number.isNaN(Number(values.fees)) || Number(values.fees) < 0 || Number(values.fees) > 1_000_000) {
    errors.fees = 'Fees must be a number between 0 and 1,000,000'
  }
  if (!values.about?.trim()) errors.about = 'Add a short description'
  if (!values.address?.line1?.trim()) errors['address.line1'] = 'Address line 1 is required'
  if (!values.address?.city?.trim()) errors['address.city'] = 'City is required'
  const image = imageProblem(values.image)
  if (image) errors.image = image
  return errors
}

export function validateSettings(values) {
  const errors = {}
  const intIn = (v, min, max) => isWholeNumber(v) && Number(v) >= min && Number(v) <= max
  if (!intIn(values.cancellationCutoffHours, 0, 168)) errors.cancellationCutoffHours = 'Enter whole hours from 0 to 168'
  if (!intIn(values.bookingWindowDays, 1, 365)) errors.bookingWindowDays = 'Enter whole days from 1 to 365'
  if (![15, 20, 30, 45, 60].includes(Number(values.defaultSlotMinutes))) errors.defaultSlotMinutes = 'Choose a supported slot length'
  if (!/^[A-Z]{3}$/.test(values.currency ?? '')) errors.currency = 'Use a three-letter ISO code such as INR'
  return errors
}

export function validatePrescriptionRow(row) {
  const errors = {}
  if (!row.medicine.trim()) errors.medicine = 'Medicine is required'
  if (!row.dosage.trim()) errors.dosage = 'Dosage is required'
  if (!row.frequency.trim()) errors.frequency = 'Frequency is required'
  if (!isWholeNumber(row.durationDays) || Number(row.durationDays) < 1 || Number(row.durationDays) > 365) {
    errors.durationDays = '1 to 365 days'
  }
  return errors
}
