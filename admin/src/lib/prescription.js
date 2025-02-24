import { validatePrescriptionRow } from './validation'

let counter = 0

export const emptyRow = () => ({
  key: `row-${++counter}`,
  medicine: '',
  dosage: '',
  frequency: '',
  durationDays: '',
  instructions: '',
})

/** Returns a new array with the row at `index` moved by `step` (-1 up, +1 down); out-of-range moves are ignored. */
export function moveRow(rows, index, step) {
  const target = index + step
  if (target < 0 || target >= rows.length) return rows
  const next = [...rows]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** One error object per row (empty object when the row is valid). */
export const validateRows = (rows) => rows.map(validatePrescriptionRow)

export const hasRowErrors = (errors) => errors.some((e) => Object.keys(e).length > 0)

/** Rows in the shape expected by `PATCH /appointments/:id/complete`. */
export const toPrescription = (rows) =>
  rows.map((r) => ({
    medicine: r.medicine.trim(),
    dosage: r.dosage.trim(),
    frequency: r.frequency.trim(),
    durationDays: Number(r.durationDays),
    instructions: r.instructions.trim(),
  }))
