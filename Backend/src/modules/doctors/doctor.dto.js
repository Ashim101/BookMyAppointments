import { toAddressDto } from '../../utils/schemas.js';
import { toScheduleDto } from '../scheduling/schedule.validators.js';

const round1 = (value) => Math.round(value * 10) / 10;

/** Public shape: never includes the email address or any credential. */
export const toPublicDto = (doctor, specialityName = '') => ({
  id: String(doctor._id),
  name: doctor.name,
  image: doctor.image ?? null,
  speciality: doctor.speciality,
  specialityName,
  degree: doctor.degree,
  experienceYears: doctor.experienceYears,
  about: doctor.about,
  fees: doctor.fees,
  currency: doctor.currency,
  available: doctor.available,
  address: toAddressDto(doctor.address),
  rating: {
    average: doctor.rating.count > 0 ? round1(doctor.rating.average) : 0,
    count: doctor.rating.count,
  },
});

export const toAdminDto = (doctor, specialityName = '') => ({
  ...toPublicDto(doctor, specialityName),
  email: doctor.email,
  active: doctor.active,
  createdAt: doctor.createdAt.toISOString(),
  schedule: toScheduleDto(doctor.schedule),
});
