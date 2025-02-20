export function formatCurrency(amount, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount ?? 0)
  } catch {
    return `${currency} ${amount ?? 0}`
  }
}

export function formatCompact(value) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0)
}

export const formatPercent = (fraction) => `${((fraction ?? 0) * 100).toFixed(1)}%`

export function calculateAge(dob, now = new Date()) {
  if (!dob) return null
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number)
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1
  return age < 0 ? null : age
}

export function formatAgeGender(person) {
  const age = calculateAge(person?.dob)
  const gender = person?.gender && person.gender !== 'unspecified' ? person.gender : null
  return [age === null ? null : `${age} yrs`, gender].filter(Boolean).join(', ') || '-'
}

export function initials(name = '') {
  const parts = name.replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export const formatAddress = (a) => [a?.line1, a?.line2, a?.city].filter(Boolean).join(', ') || '-'

export const slugify = (text) =>
  text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export const humanize = (value) => value.replace(/[_.-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
