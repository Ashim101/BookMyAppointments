import bcrypt from 'bcrypt';
import { AppError, notFound } from '../../utils/AppError.js';
import { buildPage, escapeRegex } from '../../utils/pagination.js';
import { todayIn } from '../../utils/time.js';
import { defaultSchedule, toScheduleDto } from '../scheduling/schedule.validators.js';
import { Speciality } from '../specialities/speciality.model.js';
import { Doctor } from './doctor.model.js';
import { toAdminDto, toPublicDto } from './doctor.dto.js';

const SORTS = {
  rating: { 'rating.average': -1, 'rating.count': -1, _id: 1 },
  fees_asc: { fees: 1, _id: 1 },
  fees_desc: { fees: -1, _id: 1 },
  experience: { experienceYears: -1, _id: 1 },
  name: { name: 1, _id: 1 },
};

export function createDoctorService({ config, clock, settings, scheduling, storage, tokens }) {
  async function specialityNames(slugs) {
    const rows = await Speciality.find({ slug: { $in: [...new Set(slugs)] } }).select('slug name').lean();
    return new Map(rows.map((row) => [row.slug, row.name]));
  }

  async function present(doctors, toDto) {
    const names = await specialityNames(doctors.map((d) => d.speciality));
    return doctors.map((d) => toDto(d, names.get(d.speciality) ?? d.speciality));
  }

  const presentOne = async (doctor, toDto) => (await present([doctor], toDto))[0];

  async function findPage(filter, sort, page, limit, toDto) {
    const [docs, total] = await Promise.all([
      Doctor.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Doctor.countDocuments(filter),
    ]);
    return buildPage(await present(docs, toDto), total, page, limit);
  }

  const nameFilter = (search) => (search ? { name: new RegExp(escapeRegex(search), 'i') } : {});

  async function listPublic({ speciality, search, minFee, maxFee, available, sort, page, limit }) {
    const filter = { active: true, ...nameFilter(search) };
    if (speciality) filter.speciality = speciality;
    if (available) filter.available = true;
    if (minFee !== undefined || maxFee !== undefined) {
      filter.fees = { ...(minFee !== undefined && { $gte: minFee }), ...(maxFee !== undefined && { $lte: maxFee }) };
    }
    return findPage(filter, SORTS[sort], page, limit, toPublicDto);
  }

  async function findActive(id) {
    const doctor = await Doctor.findOne({ _id: id, active: true });
    if (!doctor) throw notFound('Doctor');
    return doctor;
  }

  async function getPublic(id) {
    return presentOne(await findActive(id), toPublicDto);
  }

  async function getSlots(id, { from, days }) {
    const doctor = await findActive(id);
    const { timezone } = await settings.get();
    return scheduling.getAvailability(doctor, from ?? todayIn(clock.now(), timezone), days);
  }

  async function listAdmin({ search, speciality, active, page, limit }) {
    const filter = nameFilter(search);
    if (speciality) filter.speciality = speciality;
    if (active !== undefined) filter.active = active;
    return findPage(filter, { createdAt: -1 }, page, limit, toAdminDto);
  }

  async function getAdmin(id) {
    const doctor = await Doctor.findById(id);
    if (!doctor) throw notFound('Doctor');
    return presentOne(doctor, toAdminDto);
  }

  async function assertSpeciality(slug) {
    if (!(await Speciality.exists({ slug }))) {
      throw new AppError('VALIDATION_ERROR', 'Unknown speciality', [{ path: 'speciality', message: `No speciality with slug "${slug}"` }]);
    }
  }

  const emailTaken = () => new AppError('EMAIL_TAKEN', 'A doctor with this email already exists');

  async function create(input, file) {
    await assertSpeciality(input.speciality);
    const { defaultSlotMinutes, currency } = await settings.get();
    const { password, schedule, ...profile } = input;
    try {
      const doctor = await Doctor.create({
        ...profile,
        currency,
        schedule: schedule ?? defaultSchedule(defaultSlotMinutes),
        passwordHash: await bcrypt.hash(password, config.bcryptRounds),
        image: file ? await storage.saveImage(file) : null,
      });
      return await presentOne(doctor, toAdminDto);
    } catch (err) {
      if (err.code === 11000) throw emailTaken();
      throw err;
    }
  }

  async function update(id, input, file) {
    if (input.speciality) await assertSpeciality(input.speciality);
    const changes = { ...input };
    if (file) changes.image = await storage.saveImage(file);
    try {
      const doctor = await Doctor.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after', runValidators: true });
      if (!doctor) throw notFound('Doctor');
      return await presentOne(doctor, toAdminDto);
    } catch (err) {
      if (err.code === 11000) throw emailTaken();
      throw err;
    }
  }

  async function updateField(id, changes) {
    const doctor = await Doctor.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' });
    if (!doctor) throw notFound('Doctor');
    return doctor;
  }

  const setAvailability = async (id, available) => presentOne(await updateField(id, { available }), toAdminDto);

  async function setActive(id, active) {
    const doctor = await updateField(id, { active });
    if (!active) await tokens.revokeAll(id, 'doctor');
    return presentOne(doctor, toAdminDto);
  }

  async function setSchedule(id, schedule) {
    const doctor = await updateField(id, { schedule });
    return toScheduleDto(doctor.schedule);
  }

  return { listPublic, getPublic, getSlots, listAdmin, getAdmin, create, update, setAvailability, setActive, setSchedule };
}
