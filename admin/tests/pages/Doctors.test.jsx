import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Doctors from '../../src/pages/admin/Doctors'
import { body, fail, mockApi, ok } from '../helpers/http'
import { doctor, paginated, specialities } from '../helpers/fixtures'
import { renderWithProviders } from '../helpers/render'

const setup = (extra = {}) =>
  mockApi({
    'GET /admin/specialities': ok(specialities),
    'GET /admin/doctors': ok(paginated([doctor(), doctor({ id: 'd2', name: 'Dr. Bo Lin', email: 'bo@example.com', active: false })])),
    ...extra,
  })

const lastList = (calls) => calls.filter((c) => c.url === '/admin/doctors' && c.method === 'get').at(-1).params
const png = (size = 100) => new File([new Uint8Array(size)], 'photo.png', { type: 'image/png' })

describe('Doctors list', () => {
  it('renders doctors with status and passes filters to the API', async () => {
    const user = userEvent.setup()
    const calls = setup()
    renderWithProviders(<Doctors />)
    expect(await screen.findByText('Dr. Asha Rao')).toBeInTheDocument()
    expect(screen.getByText('Inactive', { selector: 'span' })).toBeInTheDocument()
    expect(lastList(calls)).toEqual({ page: 1, limit: 10 })

    await user.selectOptions(screen.getByLabelText('Speciality'), 'cardiology')
    await waitFor(() => expect(lastList(calls)).toMatchObject({ speciality: 'cardiology', page: 1 }))
    await user.selectOptions(screen.getByLabelText('Status'), 'false')
    await waitFor(() => expect(lastList(calls)).toMatchObject({ active: 'false' }))
    await user.type(screen.getByLabelText('Search by name'), 'asha')
    await waitFor(() => expect(lastList(calls)).toMatchObject({ search: 'asha' }))
  })

  it('remembers filters across visits', async () => {
    const user = userEvent.setup()
    setup()
    const first = renderWithProviders(<Doctors />)
    await screen.findByText('Dr. Asha Rao')
    await user.selectOptions(screen.getByLabelText('Status'), 'true')
    first.unmount()
    renderWithProviders(<Doctors />)
    expect(await screen.findByLabelText('Status')).toHaveValue('true')
  })

  it('toggles availability immediately', async () => {
    const user = userEvent.setup()
    const calls = setup({ 'PATCH /admin/doctors/:id/availability': ok(doctor({ available: false })) })
    renderWithProviders(<Doctors />)
    await user.click(await screen.findByRole('switch', { name: 'Dr. Asha Rao accepting bookings' }))
    await waitFor(() => expect(calls.some((c) => c.url === '/admin/doctors/d1/availability')).toBe(true))
    expect(body(calls.find((c) => c.url === '/admin/doctors/d1/availability'))).toEqual({ available: false })
  })

  it('asks for confirmation before deactivating', async () => {
    const user = userEvent.setup()
    const calls = setup({ 'PATCH /admin/doctors/:id/active': ok(doctor({ active: false })) })
    renderWithProviders(<Doctors />)
    await screen.findByText('Dr. Asha Rao')
    await user.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    expect(screen.getByRole('dialog', { name: 'Deactivate doctor?' })).toHaveTextContent('hidden from public listings')
    expect(calls.some((c) => c.method === 'patch')).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(calls.some((c) => c.method === 'patch')).toBe(false)

    await user.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(calls.some((c) => c.url === '/admin/doctors/d1/active')).toBe(true))
    expect(body(calls.find((c) => c.url === '/admin/doctors/d1/active'))).toEqual({ active: false })
  })

  it('edits a doctor schedule with the shared editor', async () => {
    const user = userEvent.setup()
    const calls = setup({ 'PUT /admin/doctors/:id/schedule': ok({}) })
    renderWithProviders(<Doctors />)
    await user.click(await screen.findByRole('button', { name: 'Edit schedule for Dr. Asha Rao' }))
    const drawer = screen.getByRole('dialog', { name: 'Schedule: Dr. Asha Rao' })
    fireEvent.change(within(drawer).getByLabelText('Monday end'), { target: { value: '13:00' } })
    await user.click(within(drawer).getByRole('button', { name: 'Save schedule' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'put')).toBe(true))
    expect(body(calls.find((c) => c.method === 'put')).weekly[0]).toMatchObject({ day: 1, end: '13:00' })
  })

  it('shows the empty state', async () => {
    setup({ 'GET /admin/doctors': ok(paginated([])) })
    renderWithProviders(<Doctors />)
    expect(await screen.findByText('No doctors match these filters.')).toBeInTheDocument()
  })

  it('shows a retryable error', async () => {
    setup({ 'GET /admin/doctors': fail(500, 'INTERNAL', 'Boom') })
    renderWithProviders(<Doctors />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('Doctor form', () => {
  const openForm = async (user) => {
    renderWithProviders(<Doctors />)
    await user.click(await screen.findByRole('button', { name: /Add doctor/ }))
    return screen.getByRole('dialog', { name: 'Add doctor' })
  }
  const fillRequired = async (user, dialog) => {
    const type = (label, value) => user.type(within(dialog).getByLabelText(label), value)
    await type(/Full name/, 'Dr. New Doc')
    await type(/^Email/, 'new@example.com')
    await type(/Initial password/, 'pass1234')
    await user.selectOptions(within(dialog).getByLabelText(/^Speciality/), 'cardiology')
    await type(/Degree/, 'MBBS')
    await type(/Experience/, '5')
    await type(/Consultation fees/, '600')
    await type(/^About/, 'Friendly physician')
    await type(/Address line 1/, '2 Lane')
    await type(/City/, 'Pune')
  }

  it('shows validation errors and sends nothing', async () => {
    const user = userEvent.setup()
    const calls = setup()
    const dialog = await openForm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Create doctor' }))
    expect(within(dialog).getByText('Enter the doctor’s full name')).toBeInTheDocument()
    expect(within(dialog).getByText('Choose a speciality')).toBeInTheDocument()
    expect(within(dialog).getByText('Experience must be a whole number between 0 and 60')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'post')).toBe(false)
  })

  it('rejects wrong image types and oversized files, and previews a good one', async () => {
    const user = userEvent.setup()
    setup()
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    const dialog = await openForm(user)
    const input = within(dialog).getByLabelText(/Photo/)

    fireEvent.change(input, { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } })
    expect(within(dialog).getByText('Image must be a JPEG, PNG or WebP file')).toBeInTheDocument()
    fireEvent.change(input, { target: { files: [png(2 * 1024 * 1024 + 1)] } })
    expect(within(dialog).getByText('Image must be 2 MB or smaller')).toBeInTheDocument()
    fireEvent.change(input, { target: { files: [png()] } })
    expect(within(dialog).queryByText(/Image must be/)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', 'blob:preview')
  })

  it('creates a doctor as multipart with the default schedule', async () => {
    const user = userEvent.setup()
    const calls = setup({ 'POST /admin/doctors': ok(doctor({ id: 'd9' })) })
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    const dialog = await openForm(user)
    await fillRequired(user, dialog)
    fireEvent.change(within(dialog).getByLabelText(/Photo/), { target: { files: [png()] } })
    await user.click(within(dialog).getByRole('button', { name: 'Create doctor' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add doctor' })).not.toBeInTheDocument())
    const post = calls.find((c) => c.method === 'post')
    expect(post.data).toBeInstanceOf(FormData)
    expect(post.data.get('email')).toBe('new@example.com')
    expect(post.data.get('experienceYears')).toBe('5')
    expect(JSON.parse(post.data.get('address'))).toEqual({ line1: '2 Lane', line2: '', city: 'Pune' })
    expect(post.data.get('image').name).toBe('photo.png')
    expect(post.data.has('schedule')).toBe(false)
  })

  it('sends a custom initial schedule only when opted in, and validates it', async () => {
    const user = userEvent.setup()
    const calls = setup({ 'POST /admin/doctors': ok(doctor()) })
    const dialog = await openForm(user)
    await fillRequired(user, dialog)
    await user.click(within(dialog).getByLabelText(/Set an initial schedule/))
    fireEvent.change(within(dialog).getByLabelText('Monday end'), { target: { value: '08:00' } })
    await user.click(within(dialog).getByRole('button', { name: 'Create doctor' }))
    expect(calls.some((c) => c.method === 'post')).toBe(false)
    expect(within(dialog).getByText('Working hours must start before it ends')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Monday end'), { target: { value: '15:00' } })
    await user.click(within(dialog).getByRole('button', { name: 'Create doctor' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'post')).toBe(true))
    const schedule = JSON.parse(calls.find((c) => c.method === 'post').data.get('schedule'))
    expect(schedule.weekly[0]).toMatchObject({ day: 1, start: '10:00', end: '15:00' })
  })

  it('maps server field errors, such as a taken email, onto the form', async () => {
    const user = userEvent.setup()
    setup({ 'POST /admin/doctors': fail(409, 'EMAIL_TAKEN', 'Email taken', [{ path: 'email', message: 'Already registered' }]) })
    const dialog = await openForm(user)
    await fillRequired(user, dialog)
    await user.click(within(dialog).getByRole('button', { name: 'Create doctor' }))
    expect(await within(dialog).findByText('Already registered')).toBeInTheDocument()
  })

  it('edits without a password field and sends a PATCH', async () => {
    const user = userEvent.setup()
    const calls = setup({ 'PATCH /admin/doctors/:id': ok(doctor()) })
    renderWithProviders(<Doctors />)
    await user.click(await screen.findByRole('button', { name: 'Edit Dr. Asha Rao' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit Dr. Asha Rao' })
    expect(within(dialog).queryByLabelText(/Initial password/)).not.toBeInTheDocument()
    await user.clear(within(dialog).getByLabelText(/Consultation fees/))
    await user.type(within(dialog).getByLabelText(/Consultation fees/), '950')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'patch')).toBe(true))
    const patch = calls.find((c) => c.method === 'patch')
    expect(patch.url).toBe('/admin/doctors/d1')
    expect(patch.data.get('fees')).toBe('950')
    expect(patch.data.has('password')).toBe(false)
  })
})
