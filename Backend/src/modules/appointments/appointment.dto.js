import { toAddressDto } from '../../utils/schemas.js';

const iso = (value) => (value ? value.toISOString() : null);

export function toAppointmentDto(a, actions) {
  return {
    id: String(a._id),
    patient: {
      id: String(a.patient._id ?? a.patient),
      name: a.patientInfo.name,
      image: a.patientInfo.image ?? null,
      email: a.patientInfo.email,
      phone: a.patientInfo.phone ?? '',
      gender: a.patientInfo.gender,
      dob: a.patientInfo.dob ?? null,
    },
    doctor: {
      id: String(a.doctor._id ?? a.doctor),
      name: a.doctorInfo.name,
      image: a.doctorInfo.image ?? null,
      speciality: a.doctorInfo.speciality,
      specialityName: a.doctorInfo.specialityName,
      address: toAddressDto(a.doctorInfo.address),
    },
    date: a.date,
    time: a.time,
    startsAt: iso(a.startsAt),
    endsAt: iso(a.endsAt),
    timezone: a.timezone,
    reason: a.reason,
    fee: a.fee,
    currency: a.currency,
    status: a.status,
    paymentStatus: a.paymentStatus,
    cancellation: a.cancellation ? { by: a.cancellation.by, reason: a.cancellation.reason, at: iso(a.cancellation.at) } : null,
    consultation: a.consultation
      ? {
          notes: a.consultation.notes,
          prescription: a.consultation.prescription.map((item) => ({
            medicine: item.medicine,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            instructions: item.instructions,
          })),
          completedAt: iso(a.consultation.completedAt),
        }
      : null,
    review: a.review ? { rating: a.review.rating, comment: a.review.comment, createdAt: iso(a.review.createdAt) } : null,
    rescheduleCount: a.rescheduleCount,
    createdAt: iso(a.createdAt),
    actions,
  };
}
