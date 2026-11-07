import { notFound } from '../../utils/AppError.js';
import { buildPage, escapeRegex } from '../../utils/pagination.js';
import { Appointment } from '../appointments/appointment.model.js';
import { Patient } from './patient.model.js';
import { toPatientDto } from './patient.dto.js';

export function createPatientService({ storage, tokens }) {
  async function getProfile(id) {
    const patient = await Patient.findById(id);
    if (!patient) throw notFound('Patient');
    return toPatientDto(patient);
  }

  async function updateProfile(id, input, file) {
    const changes = {};
    for (const key of ['name', 'phone', 'gender', 'address']) {
      if (input[key] !== undefined) changes[key] = input[key];
    }
    if (input.dob !== undefined) changes.dob = input.dob === '' ? null : input.dob;
    if (file) changes.image = await storage.saveImage(file);

    const patient = await Patient.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after', runValidators: true });
    if (!patient) throw notFound('Patient');
    return toPatientDto(patient);
  }

  async function list({ search, blocked, page, limit }) {
    const filter = {};
    if (blocked !== undefined) filter.blocked = blocked;
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    const [patients, total] = await Promise.all([
      Patient.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Patient.countDocuments(filter),
    ]);
    const counts = await Appointment.aggregate([
      { $match: { patient: { $in: patients.map((p) => p._id) } } },
      { $group: { _id: '$patient', count: { $sum: 1 } } },
    ]);
    const byPatient = new Map(counts.map((row) => [String(row._id), row.count]));
    const items = patients.map((p) => ({ ...toPatientDto(p), appointmentsCount: byPatient.get(String(p._id)) ?? 0 }));
    return buildPage(items, total, page, limit);
  }

  async function setBlocked(id, blocked) {
    const patient = await Patient.findByIdAndUpdate(id, { $set: { blocked } }, { returnDocument: 'after' });
    if (!patient) throw notFound('Patient');
    if (blocked) await tokens.revokeAll(id, 'patient');
    return toPatientDto(patient);
  }

  return { getProfile, updateProfile, list, setBlocked };
}
