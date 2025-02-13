import { AppError, notFound } from '../../utils/AppError.js';
import { paginate } from '../../utils/pagination.js';
import { Appointment } from '../appointments/appointment.model.js';
import { assertAllowed } from '../appointments/stateMachine.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Review } from './review.model.js';

const toDto = (review) => ({
  id: String(review._id),
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt.toISOString(),
  patient: { id: String(review.patient), name: review.patientName, image: review.patientImage ?? null },
  doctor: { id: String(review.doctor), name: review.doctorName },
});

export function createReviewService({ appointments }) {
  async function recomputeRating(doctorId) {
    const [stats] = await Review.aggregate([
      { $match: { doctor: doctorId } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const rating = stats ? { average: Math.round(stats.average * 100) / 100, count: stats.count } : { average: 0, count: 0 };
    await Doctor.updateOne({ _id: doctorId }, { $set: { rating } });
  }

  async function create(user, appointmentId, { rating, comment }) {
    const appointment = await appointments.findFor(user, appointmentId);
    assertAllowed('review', await appointments.context(user, appointment));

    try {
      await Review.create({
        appointment: appointment._id,
        doctor: appointment.doctor,
        patient: appointment.patient,
        patientName: appointment.patientInfo.name,
        patientImage: appointment.patientInfo.image,
        doctorName: appointment.doctorInfo.name,
        rating,
        comment,
      });
    } catch (err) {
      if (err.code === 11000) throw new AppError('ALREADY_REVIEWED', 'This appointment has already been reviewed');
      throw err;
    }
    const reviewed = await Appointment.findByIdAndUpdate(
      appointment._id,
      { $set: { review: { rating, comment, createdAt: new Date() } } },
      { returnDocument: 'after' },
    );
    await recomputeRating(appointment.doctor);
    return appointments.serialize(reviewed, user);
  }

  async function listForDoctor(doctorId, { page, limit }) {
    if (!(await Doctor.exists({ _id: doctorId, active: true }))) throw notFound('Doctor');
    return paginate(Review, { doctor: doctorId }, { page, limit, sort: { createdAt: -1 }, map: toDto });
  }

  async function listAll({ doctorId, maxRating, page, limit }) {
    const filter = {};
    if (doctorId) filter.doctor = doctorId;
    if (maxRating) filter.rating = { $lte: maxRating };
    return paginate(Review, filter, { page, limit, sort: { createdAt: -1 }, map: toDto });
  }

  async function remove(id) {
    const review = await Review.findByIdAndDelete(id);
    if (!review) throw notFound('Review');
    await Appointment.updateOne({ _id: review.appointment }, { $set: { review: null } });
    await recomputeRating(review.doctor);
    return null;
  }

  return { create, listForDoctor, listAll, remove };
}
