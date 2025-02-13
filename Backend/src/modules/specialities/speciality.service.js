import { AppError, notFound } from '../../utils/AppError.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Speciality } from './speciality.model.js';

export const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function createSpecialityService() {
  async function list() {
    const [specialities, counts] = await Promise.all([
      Speciality.find().sort({ name: 1 }).collation({ locale: 'en', strength: 2 }),
      Doctor.aggregate([{ $match: { active: true } }, { $group: { _id: '$speciality', count: { $sum: 1 } } }]),
    ]);
    const bySlug = new Map(counts.map((row) => [row._id, row.count]));
    return specialities.map((s) => ({
      id: String(s._id),
      slug: s.slug,
      name: s.name,
      description: s.description,
      doctorCount: bySlug.get(s.slug) ?? 0,
    }));
  }

  const findOne = async (id) => (await list()).find((item) => item.id === String(id));

  async function create({ name, description }) {
    const slug = slugify(name);
    if (!slug) throw new AppError('VALIDATION_ERROR', 'Name must contain letters or digits', [{ path: 'name', message: 'Invalid name' }]);
    try {
      const created = await Speciality.create({ slug, name, description });
      return await findOne(created._id);
    } catch (err) {
      if (err.code === 11000) throw new AppError('CONFLICT', 'A speciality with this name already exists');
      throw err;
    }
  }

  /** The slug is a stable reference used by doctors and appointments, so renaming keeps it. */
  async function update(id, changes) {
    try {
      const updated = await Speciality.findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after' });
      if (!updated) throw notFound('Speciality');
    } catch (err) {
      if (err.code === 11000) throw new AppError('CONFLICT', 'A speciality with this name already exists');
      throw err;
    }
    return findOne(id);
  }

  async function remove(id) {
    const speciality = await Speciality.findById(id);
    if (!speciality) throw notFound('Speciality');
    if (await Doctor.exists({ speciality: speciality.slug })) {
      throw new AppError('CONFLICT', 'Doctors still use this speciality');
    }
    await speciality.deleteOne();
    return null;
  }

  return { list, create, update, remove };
}
