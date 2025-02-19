import { request } from './client'

export const getProfile = () => request({ method: 'get', url: '/patient/profile' })

export function updateProfile({ name, phone, gender, dob, address, image }) {
  const form = new FormData()
  form.append('name', name)
  form.append('phone', phone)
  form.append('gender', gender)
  form.append('dob', dob || '')
  form.append('address', JSON.stringify(address))
  if (image) form.append('image', image)
  return request({ method: 'patch', url: '/patient/profile', data: form })
}
