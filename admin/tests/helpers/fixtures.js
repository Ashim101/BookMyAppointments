export const paginated = (items, extra = {}) => ({
  items,
  page: 1,
  limit: 10,
  total: items.length,
  totalPages: items.length ? 1 : 0,
  ...extra,
})

const noActions = { canCancel: false, canReschedule: false, canPay: false, canReview: false, canComplete: false, canMarkNoShow: false }

export const appointment = (overrides = {}) => ({
  id: 'a1',
  patient: { id: 'p1', name: 'Pat Ient', image: null, email: 'pat@x.io', phone: '98765', gender: 'female', dob: '1990-01-01' },
  doctor: {
    id: 'd1', name: 'Dr. Asha Rao', image: null, speciality: 'cardiology', specialityName: 'Cardiology',
    address: { line1: '1 Road', line2: '', city: 'Pune' },
  },
  date: '2026-11-09',
  time: '10:00',
  startsAt: '2026-11-09T04:30:00.000Z',
  endsAt: '2026-11-09T05:00:00.000Z',
  timezone: 'Asia/Kolkata',
  reason: 'Persistent cough',
  fee: 500,
  currency: 'INR',
  status: 'booked',
  paymentStatus: 'paid',
  cancellation: null,
  consultation: null,
  review: null,
  rescheduleCount: 0,
  createdAt: '2026-11-01T00:00:00.000Z',
  actions: { ...noActions },
  ...overrides,
})

export const withActions = (actions, overrides) => appointment({ actions: { ...noActions, ...actions }, ...overrides })

export const doctor = (overrides = {}) => ({
  id: 'd1',
  name: 'Dr. Asha Rao',
  email: 'asha@example.com',
  image: null,
  speciality: 'cardiology',
  specialityName: 'Cardiology',
  degree: 'MD',
  experienceYears: 8,
  about: 'Cardiologist',
  fees: 800,
  currency: 'INR',
  available: true,
  active: true,
  address: { line1: '1 Road', line2: '', city: 'Pune' },
  rating: { average: 4.5, count: 2 },
  createdAt: '2026-01-01T00:00:00.000Z',
  schedule: { slotMinutes: 30, weekly: [{ day: 1, start: '09:00', end: '12:00', breaks: [] }] },
  ...overrides,
})

export const specialities = [
  { id: 's1', slug: 'cardiology', name: 'Cardiology', description: 'Heart', doctorCount: 2 },
  { id: 's2', slug: 'skin', name: 'Dermatology', description: '', doctorCount: 0 },
]
