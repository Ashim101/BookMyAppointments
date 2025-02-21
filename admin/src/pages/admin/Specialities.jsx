import { useState } from 'react'
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi'
import { createSpeciality, deleteSpeciality, listSpecialities, updateSpeciality } from '../../api/admin'
import ErrorState from '../../components/ErrorState'
import PageHeader from '../../components/PageHeader'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DataTable from '../../components/ui/DataTable'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'
import { useFetch, useMutation } from '../../hooks/useFetch'
import { fieldErrors } from '../../lib/errorCodes'
import { slugify } from '../../lib/format'

function SpecialityForm({ speciality, onClose, onSaved }) {
  const [values, setValues] = useState({ name: speciality?.name ?? '', description: speciality?.description ?? '' })
  const [errors, setErrors] = useState({})
  const save = useMutation(
    (body) => (speciality ? updateSpeciality(speciality.id, body) : createSpeciality(body)),
    { success: speciality ? 'Speciality updated' : 'Speciality created' },
  )

  const submit = async (event) => {
    event.preventDefault()
    const name = values.name.trim()
    if (name.length < 2) {
      setErrors({ name: 'Enter a name of at least 2 characters' })
      return
    }
    const result = await save.run({ name, description: values.description.trim() })
    if (result.ok) onSaved()
    else setErrors(fieldErrors(result.error))
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={speciality ? 'Edit speciality' : 'Add speciality'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="speciality-form" loading={save.pending}>
            Save
          </Button>
        </>
      }
    >
      <form id="speciality-form" onSubmit={submit} noValidate className="space-y-4">
        <Input
          label="Name"
          required
          value={values.name}
          error={errors.name}
          hint={values.name.trim() ? `Slug: ${slugify(values.name)}` : 'The slug is generated from the name.'}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
        <Textarea
          label="Description"
          value={values.description}
          error={errors.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
        />
      </form>
    </Modal>
  )
}

export default function Specialities() {
  const list = useFetch(listSpecialities)
  const [form, setForm] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [conflict, setConflict] = useState('')
  const remove = useMutation(() => deleteSpeciality(removing.id), {
    success: 'Speciality deleted',
    quiet: (error) => error.code === 'CONFLICT',
  })

  const closeRemove = () => {
    setRemoving(null)
    setConflict('')
  }

  const confirmRemove = async () => {
    const result = await remove.run()
    if (result.ok) {
      closeRemove()
      list.reload()
    } else if (result.error.code === 'CONFLICT') {
      setConflict(
        `${removing.doctorCount} doctor${removing.doctorCount === 1 ? ' still uses' : 's still use'} this speciality. Reassign them to another speciality first.`,
      )
    }
  }

  const columns = [
    { key: 'name', header: 'Name', sortable: true, render: (s) => <span className="font-medium text-slate-900">{s.name}</span> },
    { key: 'slug', header: 'Slug', render: (s) => <code className="text-xs">{s.slug}</code> },
    { key: 'description', header: 'Description', render: (s) => s.description || '-' },
    { key: 'doctorCount', header: 'Doctors', sortable: true },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      render: (s) => (
        <span className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" aria-label={`Edit ${s.name}`} onClick={() => setForm({ speciality: s })}>
            <FiEdit2 aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" aria-label={`Delete ${s.name}`} onClick={() => setRemoving(s)}>
            <FiTrash2 aria-hidden="true" />
          </Button>
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Specialities"
        subtitle="Categories patients use to find doctors."
        actions={
          <Button onClick={() => setForm({ speciality: null })}>
            <FiPlus aria-hidden="true" /> Add speciality
          </Button>
        }
      />
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : (
        <DataTable caption="Specialities" columns={columns} rows={list.data ?? []} loading={list.loading} empty="No specialities yet." />
      )}
      {form && (
        <SpecialityForm
          speciality={form.speciality}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            list.reload()
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title="Delete speciality?"
        message={`"${removing?.name}" will be removed permanently.`}
        confirmLabel="Delete"
        loading={remove.pending}
        onConfirm={confirmRemove}
        onCancel={closeRemove}
      >
        {conflict && (
          <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {conflict}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
