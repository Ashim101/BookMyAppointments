import { AppError, badRequest, notFound } from '../../utils/AppError.js';
import { addMonths, startOfMonth, startOfZonedDay, todayIn } from '../../utils/time.js';
import { Appointment } from '../appointments/appointment.model.js';
import { Leave } from '../scheduling/leave.model.js';
import { toScheduleDto } from '../scheduling/schedule.validators.js';
import { Doctor } from './doctor.model.js';

const SERIES_MONTHS = 6;
const toLeaveDto = (leave) => ({ id: String(leave._id), date: leave.date, reason: leave.reason });

/** Doctor-facing operations: own profile, schedule, leave days and dashboard. */
export function createDoctorSelfService({ settings, clock, doctors, appointments }) {
  const getProfile = (user) => doctors.getAdmin(user.id);

  async function updateProfile(user, changes) {
    return doctors.update(user.id, changes);
  }

  async function getSchedule(user) {
    const doctor = await Doctor.findById(user.id).select('schedule');
    if (!doctor) throw notFound('Doctor');
    return toScheduleDto(doctor.schedule);
  }

  const setSchedule = (user, schedule) => doctors.setSchedule(user.id, schedule);

  async function listLeaves(user) {
    const { timezone } = await settings.get();
    const leaves = await Leave.find({ doctor: user.id, date: { $gte: todayIn(clock.now(), timezone) } }).sort({ date: 1 });
    return leaves.map(toLeaveDto);
  }

  async function addLeave(user, { date, reason, cancelAppointments }) {
    const { timezone } = await settings.get();
    if (date < todayIn(clock.now(), timezone)) throw badRequest('Leave cannot start in the past');

    const affected = await appointments.countBookedOn(user.id, date);
    if (affected > 0 && !cancelAppointments) {
      throw new AppError('CONFLICT', `${affected} booked appointment(s) exist on this day. Cancel them or send cancelAppointments: true.`, [
        { path: 'date', message: `${affected} appointment(s) affected` },
      ]);
    }
    let leave;
    try {
      leave = await Leave.create({ doctor: user.id, date, reason });
    } catch (err) {
      if (err.code === 11000) throw new AppError('CONFLICT', 'You already have leave on this day');
      throw err;
    }
    if (affected > 0) await appointments.cancelForLeave(user.id, date, reason || 'Doctor is on leave');
    return toLeaveDto(leave);
  }

  async function removeLeave(user, id) {
    const removed = await Leave.findOneAndDelete({ _id: id, doctor: user.id });
    if (!removed) throw notFound('Leave');
    return null;
  }

  /** Sums paid fees per month label (YYYY-MM) in the clinic timezone. */
  async function earningsByMonth(doctorId, since, timezone) {
    const rows = await Appointment.aggregate([
      { $match: { doctor: doctorId, paymentStatus: 'paid', startsAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$startsAt', timezone } }, amount: { $sum: '$fee' } } },
    ]);
    return new Map(rows.map((row) => [row._id, row.amount]));
  }

  async function dashboard(user) {
    const { timezone } = await settings.get();
    const now = new Date(clock.now());
    const today = todayIn(now, timezone);
    const doctor = await Doctor.findById(user.id).select('rating');
    const doctorId = doctor._id;
    const thisMonth = startOfMonth(today);
    const firstMonth = addMonths(thisMonth, -(SERIES_MONTHS - 1));
    const monthStart = new Date(startOfZonedDay(thisMonth, timezone));

    const [statusRows, upcoming, todayCount, patientRows, earnings, upcomingList, byMonth] = await Promise.all([
      Appointment.aggregate([{ $match: { doctor: doctorId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Appointment.countDocuments({ doctor: doctorId, status: 'booked', startsAt: { $gt: now } }),
      Appointment.countDocuments({ doctor: doctorId, date: today, status: { $in: ['booked', 'completed'] } }),
      Appointment.aggregate([
        { $match: { doctor: doctorId, status: { $in: ['booked', 'completed'] } } },
        { $group: { _id: '$patient' } },
        { $count: 'patients' },
      ]),
      Appointment.aggregate([
        { $match: { doctor: doctorId, paymentStatus: 'paid' } },
        {
          $group: {
            _id: null,
            total: { $sum: '$fee' },
            thisMonth: { $sum: { $cond: [{ $gte: ['$startsAt', monthStart] }, '$fee', 0] } },
          },
        },
      ]),
      Appointment.find({ doctor: doctorId, status: 'booked', startsAt: { $gte: now } }).sort({ startsAt: 1 }).limit(5),
      earningsByMonth(doctorId, new Date(startOfZonedDay(firstMonth, timezone)), timezone),
    ]);

    const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
    return {
      earnings: { total: earnings[0]?.total ?? 0, thisMonth: earnings[0]?.thisMonth ?? 0 },
      patients: patientRows[0]?.patients ?? 0,
      appointments: {
        today: todayCount,
        upcoming,
        completed: counts.completed ?? 0,
        cancelled: counts.cancelled ?? 0,
        noShow: counts.no_show ?? 0,
      },
      rating: { average: doctor.rating.count ? Math.round(doctor.rating.average * 10) / 10 : 0, count: doctor.rating.count },
      next: await appointments.serializeMany(upcomingList, user),
      earningsSeries: Array.from({ length: SERIES_MONTHS }, (_, i) => {
        const period = addMonths(firstMonth, i).slice(0, 7);
        return { period, amount: byMonth.get(period) ?? 0 };
      }),
    };
  }

  const patientHistory = (user, patientId) => appointments.listForDoctorPatient(user, patientId);

  return { getProfile, updateProfile, getSchedule, setSchedule, listLeaves, addLeave, removeLeave, dashboard, patientHistory };
}
