export const emptyDoctorForm = () => ({
  name: '',
  email: '',
  password: '',
  speciality: '',
  degree: '',
  experienceYears: '',
  about: '',
  fees: '',
  address: { line1: '', line2: '', city: '' },
  image: null,
})

export const doctorToForm = (doctor) => ({
  ...emptyDoctorForm(),
  name: doctor.name,
  email: doctor.email,
  speciality: doctor.speciality,
  degree: doctor.degree,
  experienceYears: String(doctor.experienceYears),
  about: doctor.about,
  fees: String(doctor.fees),
  address: { line1: doctor.address.line1, line2: doctor.address.line2 ?? '', city: doctor.address.city },
})

/** Converts form state into the payload accepted by the create and update endpoints. */
export function formToPayload(values, { isEdit, schedule }) {
  const payload = {
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    speciality: values.speciality,
    degree: values.degree.trim(),
    experienceYears: Number(values.experienceYears),
    about: values.about.trim(),
    fees: Number(values.fees),
    address: {
      line1: values.address.line1.trim(),
      line2: values.address.line2.trim(),
      city: values.address.city.trim(),
    },
    image: values.image,
  }
  if (!isEdit) {
    payload.password = values.password
    if (schedule) payload.schedule = schedule
  }
  return payload
}
