import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { makeDoctor, page } from '../test/factories'
import { fail, mockApi, ok } from '../test/http'
import { currentLocation, renderApp } from '../test/render'
import Doctors from './Doctors'

const specialities = [
  { id: 's1', slug: 'cardiologist', name: 'Cardiologist', description: '', doctorCount: 2 },
  { id: 's2', slug: 'dermatologist', name: 'Dermatologist', description: '', doctorCount: 1 },
]

function api(listing = () => ok(page([makeDoctor(), makeDoctor({ id: 'd2', name: 'Dr. Omar Rao' })]))) {
  return mockApi((config) => (config.url === '/specialities' ? ok(specialities) : listing(config)))
}
const open = (route = '/doctors') => renderApp(<Doctors />, { route, path: '/doctors', loggedIn: false })
const lastQuery = (calls) => calls.filter((c) => c.url === '/doctors').at(-1).params

describe('find doctors', () => {
  it('lists doctors with default sorting', async () => {
    const calls = api()
    open()
    expect(await screen.findByText('Dr. Omar Rao')).toBeInTheDocument()
    expect(screen.getByText('2 doctors found')).toBeInTheDocument()
    expect(lastQuery(calls)).toEqual({ sort: 'rating', page: 1, limit: 9 })
  })

  it('reads filters from the URL', async () => {
    const calls = api()
    open('/doctors?search=nair&speciality=cardiologist&minFee=100&maxFee=900&available=true&sort=fees_asc&page=2')
    await screen.findByText('Dr. Omar Rao')
    expect(lastQuery(calls)).toEqual({
      search: 'nair',
      speciality: 'cardiologist',
      minFee: '100',
      maxFee: '900',
      available: 'true',
      sort: 'fees_asc',
      page: 2,
      limit: 9,
    })
    expect(screen.getByLabelText('Search by name')).toHaveValue('nair')
    expect(screen.getByLabelText('Accepting bookings only')).toBeChecked()
  })

  it('writes filter changes to the URL and resets to page one', async () => {
    const user = userEvent.setup()
    const calls = api()
    open('/doctors?page=3')
    await screen.findByText('Dr. Omar Rao')
    await screen.findByRole('option', { name: 'Dermatologist' })

    await user.selectOptions(screen.getByLabelText('Speciality'), 'dermatologist')
    await waitFor(() => expect(currentLocation(screen)).toBe('/doctors?speciality=dermatologist'))
    await user.click(screen.getByLabelText('Accepting bookings only'))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'fees_desc')
    await waitFor(() => expect(lastQuery(calls)).toMatchObject({ speciality: 'dermatologist', available: 'true', sort: 'fees_desc', page: 1 }))
    expect(currentLocation(screen)).toContain('available=true')
  })

  it('debounces name search into the URL', async () => {
    const user = userEvent.setup()
    api()
    open()
    await screen.findByText('Dr. Omar Rao')
    await user.type(screen.getByLabelText('Search by name'), 'rao')
    await waitFor(() => expect(currentLocation(screen)).toBe('/doctors?search=rao'), { timeout: 2000 })
  })

  it('applies a fee range and rejects an inverted one', async () => {
    const user = userEvent.setup()
    const calls = api()
    open()
    await screen.findByText('Dr. Omar Rao')
    await user.type(screen.getByLabelText('Min'), '900')
    await user.type(screen.getByLabelText('Max'), '100')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByText(/Minimum fee cannot be higher/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Max'))
    await user.type(screen.getByLabelText('Max'), '1500')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(lastQuery(calls)).toMatchObject({ minFee: '900', maxFee: '1500' }))
  })

  it('remembers committed searches and offers them as shortcuts', async () => {
    const user = userEvent.setup()
    api()
    const { unmount } = open()
    await screen.findByText('Dr. Omar Rao')
    await user.type(screen.getByLabelText('Search by name'), 'nair{Enter}')
    unmount()

    open()
    await screen.findByText('Dr. Omar Rao')
    await user.click(screen.getByRole('button', { name: /nair/ }))
    expect(screen.getByLabelText('Search by name')).toHaveValue('nair')
  })

  it('shows the empty state and clears filters from it', async () => {
    const user = userEvent.setup()
    api((config) => ok(page(config.params.search ? [] : [makeDoctor()])))
    open('/doctors?search=zzz')
    expect(await screen.findByText('No doctors match your search')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Clear/ }).at(0))
    expect(await screen.findByText('Dr. Priya Nair')).toBeInTheDocument()
    expect(currentLocation(screen)).toBe('/doctors')
  })

  it('shows an error state and retries', async () => {
    const user = userEvent.setup()
    let attempt = 0
    api(() => (attempt++ === 0 ? fail(500, 'INTERNAL') : ok(page([makeDoctor()]))))
    open()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Dr. Priya Nair')).toBeInTheDocument()
  })

  it('paginates through the URL', async () => {
    const user = userEvent.setup()
    api((config) => ok(page([makeDoctor()], { page: config.params.page, total: 20, totalPages: 3 })))
    open()
    await screen.findByText('Dr. Priya Nair')
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(currentLocation(screen)).toBe('/doctors?page=2'))
  })
})
