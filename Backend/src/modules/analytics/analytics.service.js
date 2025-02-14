import { badRequest } from '../../utils/AppError.js';
import {
  addDays,
  addMonths,
  daysBetween,
  startOfMonth,
  startOfWeek,
  startOfZonedDay,
  todayIn,
} from '../../utils/time.js';
import { Appointment } from '../appointments/appointment.model.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import { Review } from '../reviews/review.model.js';

const MAX_PERIODS = 400;
const DEFAULT_RANGE_DAYS = 30;
const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;
const countIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });
const PAID = { $eq: ['$paymentStatus', 'paid'] };
const revenueIf = (condition) => ({ $sum: { $cond: [condition, '$fee', 0] } });

/** Every period label from `from` to `to`, so empty periods are reported as zeros. */
export function listPeriods(from, to, interval) {
  const labels = [];
  if (interval === 'day') {
    for (let day = from; day <= to; day = addDays(day, 1)) labels.push(day);
  } else if (interval === 'week') {
    for (let week = startOfWeek(from); week <= to; week = addDays(week, 7)) labels.push(week);
  } else {
    for (let month = startOfMonth(from); month <= to; month = addMonths(month, 1))
      labels.push(month.slice(0, 7));
  }
  return labels;
}

export function createAnalyticsService({ settings, clock }) {
  async function summary() {
    const now = new Date(clock.now());
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const [doctors, activeDoctors, patients, statusRows, revenueRows, ratingRows] = await Promise.all([
      Doctor.countDocuments(),
      Doctor.countDocuments({ active: true }),
      Patient.countDocuments(),
      Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Appointment.aggregate([
        { $match: { paymentStatus: 'paid' } },
        {
          $group: {
            _id: null,
            total: { $sum: '$fee' },
            last30Days: {
              $sum: {
                $cond: [{ $and: [{ $gte: ['$startsAt', since] }, { $lte: ['$startsAt', now] }] }, '$fee', 0],
              },
            },
          },
        },
      ]),
      Review.aggregate([{ $group: { _id: null, average: { $avg: '$rating' } } }]),
    ]);

    const counts = Object.fromEntries(statusRows.map((row) => [row._id, row.count]));
    const total = statusRows.reduce((sum, row) => sum + row.count, 0);
    return {
      doctors,
      activeDoctors,
      patients,
      appointments: {
        total,
        booked: counts.booked ?? 0,
        completed: counts.completed ?? 0,
        cancelled: counts.cancelled ?? 0,
        noShow: counts.no_show ?? 0,
      },
      revenue: { total: revenueRows[0]?.total ?? 0, last30Days: revenueRows[0]?.last30Days ?? 0 },
      cancellationRate: total === 0 ? 0 : round((counts.cancelled ?? 0) / total, 3),
      averageRating: round(ratingRows[0]?.average ?? 0, 1),
    };
  }

  function periodExpression(interval, timezone) {
    const label = (date, format) => ({ $dateToString: { format, date, timezone } });
    if (interval === 'month') return label('$startsAt', '%Y-%m');
    if (interval === 'day') return label('$startsAt', '%Y-%m-%d');
    return label(
      { $dateTrunc: { date: '$startsAt', unit: 'week', startOfWeek: 'monday', timezone } },
      '%Y-%m-%d',
    );
  }

  async function timeseries({ from, to, interval }) {
    const { timezone } = await settings.get();
    const end = to ?? todayIn(clock.now(), timezone);
    const start = from ?? addDays(end, -(DEFAULT_RANGE_DAYS - 1));
    if (start > end) throw badRequest('`from` must not be after `to`');
    const periods = listPeriods(start, end, interval);
    if (periods.length > MAX_PERIODS || daysBetween(start, end) > 3660)
      throw badRequest('The requested range is too large');

    const rows = await Appointment.aggregate([
      {
        $match: {
          startsAt: {
            $gte: new Date(startOfZonedDay(start, timezone)),
            $lt: new Date(startOfZonedDay(addDays(end, 1), timezone)),
          },
        },
      },
      {
        $group: {
          _id: periodExpression(interval, timezone),
          appointments: { $sum: 1 },
          completed: countIf({ $eq: ['$status', 'completed'] }),
          cancelled: countIf({ $eq: ['$status', 'cancelled'] }),
          revenue: revenueIf(PAID),
        },
      },
    ]);
    const byPeriod = new Map(rows.map((row) => [row._id, row]));
    return periods.map((period) => {
      const row = byPeriod.get(period);
      return {
        period,
        appointments: row?.appointments ?? 0,
        completed: row?.completed ?? 0,
        cancelled: row?.cancelled ?? 0,
        revenue: row?.revenue ?? 0,
      };
    });
  }

  async function specialities() {
    const rows = await Appointment.aggregate([
      {
        $group: {
          _id: '$doctorInfo.speciality',
          specialityName: { $first: '$doctorInfo.specialityName' },
          appointments: { $sum: 1 },
          revenue: revenueIf(PAID),
        },
      },
      { $sort: { appointments: -1, _id: 1 } },
    ]);
    return rows.map((row) => ({
      speciality: row._id,
      specialityName: row.specialityName,
      appointments: row.appointments,
      revenue: row.revenue,
    }));
  }

  async function topDoctors({ limit }) {
    const rows = await Appointment.aggregate([
      { $group: { _id: '$doctor', appointments: { $sum: 1 }, revenue: revenueIf(PAID) } },
      { $sort: { appointments: -1, revenue: -1, _id: 1 } },
      { $limit: limit },
      { $lookup: { from: Doctor.collection.name, localField: '_id', foreignField: '_id', as: 'doctor' } },
      { $unwind: '$doctor' },
    ]);
    return rows.map((row) => ({
      doctor: {
        id: String(row._id),
        name: row.doctor.name,
        image: row.doctor.image ?? null,
        speciality: row.doctor.speciality,
      },
      appointments: row.appointments,
      revenue: row.revenue,
      rating: row.doctor.rating.count > 0 ? round(row.doctor.rating.average, 1) : 0,
    }));
  }

  return { summary, timeseries, specialities, topDoctors };
}
