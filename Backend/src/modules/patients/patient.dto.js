import { toAddressDto } from '../../utils/schemas.js';

export const toPatientDto = (patient) => ({
  id: String(patient._id),
  name: patient.name,
  email: patient.email,
  image: patient.image ?? null,
  phone: patient.phone ?? '',
  gender: patient.gender,
  dob: patient.dob ?? null,
  address: toAddressDto(patient.address),
  blocked: patient.blocked,
  createdAt: patient.createdAt.toISOString(),
});
