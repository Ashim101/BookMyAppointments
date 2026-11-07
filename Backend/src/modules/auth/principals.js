import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';

export const toAuthUser = (principal) => ({
  id: principal.id,
  name: principal.name,
  email: principal.email,
  role: principal.role,
  image: principal.image ?? null,
});

const blocked = () => new AppError('ACCOUNT_BLOCKED', 'This account has been disabled. Please contact support.');

/** Resolves the account behind a token and rejects blocked or deactivated accounts. */
export function createPrincipals({ config }) {
  const admin = { id: 'admin', role: 'admin', name: 'Administrator', email: config.admin.email, image: null };

  async function load(role, id) {
    if (role === 'admin') return config.admin.email && id === 'admin' ? admin : null;
    if (!mongoose.isValidObjectId(id)) return null;

    if (role === 'patient') {
      const patient = await Patient.findById(id).select('name email image blocked').lean();
      if (!patient) return null;
      if (patient.blocked) throw blocked();
      return { id: String(patient._id), role, name: patient.name, email: patient.email, image: patient.image };
    }
    if (role === 'doctor') {
      const doctor = await Doctor.findById(id).select('name email image active').lean();
      if (!doctor) return null;
      if (!doctor.active) throw blocked();
      return { id: String(doctor._id), role, name: doctor.name, email: doctor.email, image: doctor.image };
    }
    return null;
  }

  return { load, admin };
}
