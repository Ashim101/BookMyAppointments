export const PAGE_SIZE = 9

export function readQuery(params) {
  return {
    search: params.get('search') || '',
    speciality: params.get('speciality') || '',
    minFee: params.get('minFee') || '',
    maxFee: params.get('maxFee') || '',
    available: params.get('available') === 'true',
    sort: params.get('sort') || 'rating',
    page: Math.max(1, Number(params.get('page')) || 1),
  }
}

export function toApiParams(query) {
  const out = { sort: query.sort, page: query.page, limit: PAGE_SIZE }
  for (const key of ['search', 'speciality', 'minFee', 'maxFee']) if (query[key]) out[key] = query[key]
  if (query.available) out.available = 'true'
  return out
}

export const SORT_OPTIONS = [
  { value: 'rating', label: 'Top rated' },
  { value: 'fees_asc', label: 'Fee: low to high' },
  { value: 'fees_desc', label: 'Fee: high to low' },
  { value: 'experience', label: 'Most experienced' },
  { value: 'name', label: 'Name (A to Z)' },
]
