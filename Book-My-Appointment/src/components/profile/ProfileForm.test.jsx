import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'react-toastify'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fail, mockApi, ok } from '../../test/http'
import { renderApp } from '../../test/render'
import ProfileForm from './ProfileForm'

vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const patient = {
  id: 'p1',
  name: 'Asha Kumar',
  email: 'asha@example.com',
  image: null,
  phone: '+91 98765 43210',
  gender: 'female',
  dob: '1994-05-12',
  address: { line1: '12 Lake Road', line2: '', city: 'Pune' },
  blocked: false,
  createdAt: '2026-01-01T00:00:00Z',
}

const png = (size = 1024, type = 'image/png') => new File([new Uint8Array(size)], 'me.png', { type })
const upload = (file) => userEvent.setup({ applyAccept: false }).upload(screen.getByLabelText('Profile photo'), file)

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

describe('ProfileForm', () => {
  it('shows validation errors and does not call the API', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(patient))
    renderApp(<ProfileForm patient={patient} />)

    await user.clear(screen.getByLabelText('Full name'))
    await user.clear(screen.getByLabelText('Phone'))
    await user.type(screen.getByLabelText('Phone'), 'call me')
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2999-01-01' } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Enter your full name')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid phone number')).toBeInTheDocument()
    expect(screen.getByText('Date of birth cannot be in the future')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true')
    expect(calls).toHaveLength(0)
  })

  it('saves as multipart form data and updates the signed-in user', async () => {
    const user = userEvent.setup()
    const saved = { ...patient, name: 'Asha K', image: 'https://cdn.example.com/me.png' }
    const calls = mockApi(() => ok(saved))
    const { store } = renderApp(<ProfileForm patient={patient} />)

    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), 'Asha K')
    await user.selectOptions(screen.getByLabelText('Gender'), 'other')
    await upload(png())
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Profile updated.'))
    expect(calls[0].method).toBe('patch')
    expect(calls[0].url).toBe('/patient/profile')
    const form = calls[0].data
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('name')).toBe('Asha K')
    expect(form.get('gender')).toBe('other')
    expect(form.get('dob')).toBe('1994-05-12')
    expect(JSON.parse(form.get('address'))).toEqual({ line1: '12 Lake Road', line2: '', city: 'Pune' })
    expect(form.get('image')).toBeInstanceOf(File)
    expect(store.getState().auth.tokens.user).toMatchObject({ name: 'Asha K', image: saved.image })
  })

  it('omits the image field when no photo was chosen', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(patient))
    renderApp(<ProfileForm patient={patient} />)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].data.has('image')).toBe(false)
  })

  it('previews a valid image', async () => {
    renderApp(<ProfileForm patient={patient} />)
    await upload(png())
    expect(await screen.findByRole('button', { name: 'Choose a different photo' })).toBeInTheDocument()
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(screen.getByAltText('Asha Kumar')).toHaveAttribute('src', 'blob:preview')
  })

  it('rejects images of the wrong type', async () => {
    renderApp(<ProfileForm patient={patient} />)
    await upload(png(1024, 'image/gif'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Use a JPEG, PNG or WebP image')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('rejects images larger than 2 MB', async () => {
    renderApp(<ProfileForm patient={patient} />)
    await upload(png(2 * 1024 * 1024 + 1))
    expect(await screen.findByRole('alert')).toHaveTextContent('Image must be 2 MB or smaller')
  })

  it('blocks saving while the chosen image is invalid', async () => {
    const user = userEvent.setup()
    const calls = mockApi(() => ok(patient))
    renderApp(<ProfileForm patient={patient} />)
    await upload(png(1024, 'image/gif'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(calls).toHaveLength(0)
  })

  it('maps server validation details onto the fields', async () => {
    const user = userEvent.setup()
    mockApi(() => fail(400, 'VALIDATION_ERROR', 'Invalid', [{ path: 'phone', message: 'Phone already in use' }]))
    renderApp(<ProfileForm patient={patient} />)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Phone already in use')).toBeInTheDocument()
    expect(toast.error).toHaveBeenCalled()
  })

  it('keeps the email read-only', () => {
    renderApp(<ProfileForm patient={patient} />)
    expect(screen.getByLabelText('Email')).toBeDisabled()
  })
})
