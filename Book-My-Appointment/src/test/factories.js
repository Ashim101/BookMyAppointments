export const session = {
  accessToken: 'access-1',
  refreshToken: 'refresh-1',
  user: { id: 'p1', name: 'Asha Kumar', email: 'asha@example.com', role: 'patient', image: null },
}

export const makeDoctor = (overrides = {}) => ({
  id: 'd1',
  name: 'Dr. Priya Nair',
  image: null,
  speciality: 'cardiologist',
  specialityName: 'Cardiologist',
  degree: 'MD, DM',
  experienceYears: 12,
  about: 'Focused on preventive heart care.',
  fees: 800,
  currency: 'INR',
  available: true,
  address: { line1: '4 Park Street', line2: '', city: 'Pune' },
  rating: { average: 4.6, count: 21 },
  ...overrides,
})

export const makeAppointment = (overrides = {}) => {
  const { actions, ...rest } = overrides
  return {
    id: 'a1',
    patient: { id: 'p1', name: 'Asha Kumar', image: null, email: 'asha@example.com', phone: '', gender: 'female', dob: null },
    doctor: {
      id: 'd1',
      name: 'Dr. Priya Nair',
      image: null,
      speciality: 'cardiologist',
      specialityName: 'Cardiologist',
      address: { line1: '4 Park Street', line2: '', city: 'Pune' },
    },
    date: '2026-12-10',
    time: '10:30',
    startsAt: '2026-12-10T05:00:00.000Z',
    endsAt: '2026-12-10T05:30:00.000Z',
    timezone: 'Asia/Kolkata',
    reason: 'Chest pain follow-up',
    fee: 800,
    currency: 'INR',
    status: 'booked',
    paymentStatus: 'unpaid',
    cancellation: null,
    consultation: null,
    review: null,
    rescheduleCount: 0,
    createdAt: '2026-11-01T08:00:00.000Z',
    ...rest,
    actions: {
      canCancel: false,
      canReschedule: false,
      canPay: false,
      canReview: false,
      canComplete: false,
      canMarkNoShow: false,
      ...actions,
    },
  }
}

export const makeSlots = (days = [['2026-12-10', ['09:00', '09:30', '10:00']]], unavailable = []) => ({
  timezone: 'Asia/Kolkata',
  slotMinutes: 30,
  days: days.map(([date, times]) => ({
    date,
    weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
    slots: times.map((time) => ({ time, available: !unavailable.includes(`${date} ${time}`) })),
  })),
})

export const page = (items, extra = {}) => ({ items, page: 1, limit: 10, total: items.length, totalPages: 1, ...extra })
