import { clean, client } from './client'

export const listDoctors = (params) => client.get('/admin/doctors', { params: clean(params) })

/** Builds the multipart payload for create and update. Empty optional values are omitted. */
export function toDoctorFormData(values) {
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue
    if (key === 'address' || key === 'schedule') form.append(key, JSON.stringify(value))
    else form.append(key, value)
  }
  return form
}

export const createDoctor = (values) => client.post('/admin/doctors', toDoctorFormData(values))

export const updateDoctor = (id, values) => client.patch(`/admin/doctors/${id}`, toDoctorFormData(values))

export const setDoctorAvailability = (id, available) =>
  client.patch(`/admin/doctors/${id}/availability`, { available })

export const setDoctorActive = (id, active) => client.patch(`/admin/doctors/${id}/active`, { active })

export const saveDoctorSchedule = (id, schedule) => client.put(`/admin/doctors/${id}/schedule`, schedule)
