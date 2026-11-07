import { AppError, notFound } from '../../utils/AppError.js';
import { paginate } from '../../utils/pagination.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import { Speciality } from '../specialities/speciality.model.js';
import { Appointment, patientKey, slotKey } from './appointment.model.js';
import { toAppointmentDto } from './appointment.dto.js';
import { assertAllowed, computeActions } from './stateMachine.js';

const RELEASE_KEYS = { activeSlotKey: '', activePatientKey: '' };

const scopeFor = (user) => {
  if (user.role === 'patient') return { patient: user.id };
  if (user.role === 'doctor') return { doctor: user.id };
  return {};
};

/** Maps a unique-index violation to the error a client should see. */
function translateDuplicate(err) {
  if (err.code !== 11000) return err;
  if (err.keyPattern?.activePatientKey || /activePatientKey/.test(err.message)) {
    return new AppError('CONFLICT', 'You already have an appointment at this time');
  }
  return new AppError('SLOT_TAKEN', 'That slot has just been taken. Please choose another.');
}

export function createAppointmentService({ settings, scheduling, notifications, refunds, clock }) {
  const nowMs = () => clock.now();

  async function serialize(appointment, user, settingsValue) {
    const ctx = { appointment, user, now: nowMs(), settings: settingsValue ?? (await settings.get()) };
    return toAppointmentDto(appointment, computeActions(ctx));
  }

  async function serializeMany(appointments, user) {
    const current = await settings.get();
    return appointments.map((appointment) =>
      toAppointmentDto(appointment, computeActions({ appointment, user, now: nowMs(), settings: current })),
    );
  }

  /** Looks an appointment up within what `user` is allowed to see; anything else is a 404. */
  async function findFor(user, id) {
    const appointment = await Appointment.findOne({ _id: id, ...scopeFor(user) });
    if (!appointment) throw notFound('Appointment');
    return appointment;
  }

  async function context(user, appointment) {
    return { appointment, user, now: nowMs(), settings: await settings.get() };
  }

  async function book(user, { doctorId, date, time, reason = '' }) {
    const [doctor, patient] = await Promise.all([Doctor.findOne({ _id: doctorId, active: true }), Patient.findById(user.id)]);
    if (!doctor) throw notFound('Doctor');
    if (!patient || patient.blocked) throw new AppError('ACCOUNT_BLOCKED', 'This account has been disabled');
    if (!doctor.available) throw new AppError('SLOT_UNAVAILABLE', 'This doctor is not accepting bookings right now');

    const slot = await scheduling.offerSlot(doctor, date, time);
    if (!slot) throw new AppError('SLOT_UNAVAILABLE', 'That slot is not available');

    const speciality = await Speciality.findOne({ slug: doctor.speciality }).select('name').lean();
    try {
      const appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        patientInfo: { name: patient.name, image: patient.image, email: patient.email, phone: patient.phone, gender: patient.gender, dob: patient.dob },
        doctorInfo: {
          name: doctor.name,
          image: doctor.image,
          speciality: doctor.speciality,
          specialityName: speciality?.name ?? doctor.speciality,
          address: doctor.address,
        },
        date,
        time,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timezone: slot.timezone,
        reason,
        fee: doctor.fees,
        currency: doctor.currency,
        activeSlotKey: slotKey(doctor._id, date, time),
        activePatientKey: patientKey(patient._id, slot.startsAt),
      });
      await notifications.notify(
        { id: doctor._id, role: 'doctor' },
        {
          type: 'appointment_booked',
          title: 'New appointment',
          message: `${patient.name} booked ${date} at ${time}.`,
          link: `/appointments/${appointment._id}`,
        },
      );
      return serialize(appointment, user);
    } catch (err) {
      throw translateDuplicate(err);
    }
  }

  /** Filter shared by the list endpoint and the CSV export. */
  function buildFilter(user, query) {
    const filter = scopeFor(user);
    if (user.role === 'admin' && query.doctorId) filter.doctor = query.doctorId;
    if (user.role !== 'patient' && query.patientId) filter.patient = query.patientId;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.date = { ...(query.from && { $gte: query.from }), ...(query.to && { $lte: query.to }) };
    }
    if (query.scope === 'upcoming') {
      filter.status ??= 'booked';
      filter.startsAt = { $gte: new Date(nowMs()) };
    } else if (query.scope === 'past') {
      const past = [{ startsAt: { $lt: new Date(nowMs()) } }, { status: { $ne: 'booked' } }];
      filter.$and = [...(filter.$and ?? []), { $or: past }];
    }
    return filter;
  }

  const sortFor = (scope) => (scope === 'upcoming' ? { startsAt: 1, _id: 1 } : { startsAt: -1, _id: -1 });

  async function list(user, query) {
    const current = await settings.get();
    return paginate(Appointment, buildFilter(user, query), {
      page: query.page,
      limit: query.limit,
      sort: sortFor(query.scope),
      map: (appointment) => serialize(appointment, user, current),
    });
  }

  const exportCursor = (user, query) => Appointment.find(buildFilter(user, query)).sort(sortFor(query.scope)).cursor();

  async function get(user, id) {
    return serialize(await findFor(user, id), user);
  }

  /** Atomically moves a booked appointment to cancelled and frees its slot. */
  async function applyCancellation(appointment, by, reason) {
    const refundable = appointment.paymentStatus === 'paid';
    const cancelled = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: 'booked', paymentStatus: appointment.paymentStatus },
      {
        $set: {
          status: 'cancelled',
          cancellation: { by, reason, at: new Date(nowMs()) },
          ...(refundable && { paymentStatus: 'refund_pending' }),
        },
        $unset: RELEASE_KEYS,
      },
      { returnDocument: 'after' },
    );
    if (!cancelled) throw new AppError('INVALID_STATE', 'The appointment was changed by someone else. Please reload and try again.');
    return refundable ? refunds.settle(cancelled) : cancelled;
  }

  async function notifyCancellation(appointment, by, reason) {
    const detail = `${appointment.date} at ${appointment.time}${reason ? `: ${reason}` : ''}`;
    const recipients = [];
    if (by !== 'patient') recipients.push({ id: appointment.patient, role: 'patient' });
    if (by !== 'doctor') recipients.push({ id: appointment.doctor, role: 'doctor' });
    await Promise.all(
      recipients.map((recipient) =>
        notifications.notify(recipient, {
          type: 'appointment_cancelled',
          title: 'Appointment cancelled',
          message: `The appointment on ${detail} was cancelled by the ${by}.`,
          link: `/appointments/${appointment._id}`,
        }),
      ),
    );
  }

  async function cancel(user, id, { reason }) {
    const appointment = await findFor(user, id);
    assertAllowed('cancel', await context(user, appointment));
    const cancelled = await applyCancellation(appointment, user.role, reason);
    await notifyCancellation(cancelled, user.role, reason);
    return serialize(cancelled, user);
  }

  /** Cancels a doctor's future bookings on a leave day. Returns how many were cancelled. */
  async function cancelForLeave(doctorId, date, reason) {
    const affected = await Appointment.find({ doctor: doctorId, date, status: 'booked', startsAt: { $gt: new Date(nowMs()) } });
    for (const appointment of affected) {
      const cancelled = await applyCancellation(appointment, 'doctor', reason);
      await notifyCancellation(cancelled, 'doctor', reason);
    }
    return affected.length;
  }

  const countBookedOn = (doctorId, date) =>
    Appointment.countDocuments({ doctor: doctorId, date, status: 'booked', startsAt: { $gt: new Date(nowMs()) } });

  async function reschedule(user, id, { date, time }) {
    const appointment = await findFor(user, id);
    assertAllowed('reschedule', await context(user, appointment));

    const doctor = await Doctor.findOne({ _id: appointment.doctor, active: true });
    if (!doctor || !doctor.available) throw new AppError('SLOT_UNAVAILABLE', 'This doctor is not accepting bookings right now');
    const slot = await scheduling.offerSlot(doctor, date, time);
    if (!slot) throw new AppError('SLOT_UNAVAILABLE', 'That slot is not available');

    try {
      const moved = await Appointment.findOneAndUpdate(
        { _id: appointment._id, status: 'booked', rescheduleCount: appointment.rescheduleCount },
        {
          $set: {
            date,
            time,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            timezone: slot.timezone,
            reminderSentAt: null,
            activeSlotKey: slotKey(doctor._id, date, time),
            activePatientKey: patientKey(appointment.patient, slot.startsAt),
          },
          $inc: { rescheduleCount: 1 },
        },
        { returnDocument: 'after' },
      );
      if (!moved) throw new AppError('INVALID_STATE', 'The appointment was changed by someone else. Please reload and try again.');
      await notifications.notify(
        { id: moved.doctor, role: 'doctor' },
        {
          type: 'appointment_rescheduled',
          title: 'Appointment rescheduled',
          message: `${moved.patientInfo.name} moved their appointment to ${date} at ${time}.`,
          link: `/appointments/${moved._id}`,
        },
      );
      return serialize(moved, user);
    } catch (err) {
      throw translateDuplicate(err);
    }
  }

  async function complete(user, id, { notes, prescription }) {
    const appointment = await findFor(user, id);
    assertAllowed('complete', await context(user, appointment));
    const now = new Date(nowMs());
    const done = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: 'booked' },
      { $set: { status: 'completed', consultation: { notes, prescription, completedAt: now } } },
      { returnDocument: 'after' },
    );
    if (!done) throw new AppError('INVALID_STATE', 'The appointment is no longer booked');
    await notifications.notify(
      { id: done.patient, role: 'patient' },
      {
        type: 'prescription_ready',
        title: 'Consultation completed',
        message: `Dr. ${done.doctorInfo.name} completed your visit${prescription.length > 0 ? ' and added a prescription' : ''}.`,
        link: `/appointments/${done._id}`,
      },
    );
    return serialize(done, user);
  }

  async function markNoShow(user, id) {
    const appointment = await findFor(user, id);
    assertAllowed('noShow', await context(user, appointment));
    const missed = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: 'booked' },
      { $set: { status: 'no_show' }, $unset: RELEASE_KEYS },
      { returnDocument: 'after' },
    );
    if (!missed) throw new AppError('INVALID_STATE', 'The appointment is no longer booked');
    return serialize(missed, user);
  }

  async function listForDoctorPatient(doctor, patientId) {
    const appointments = await Appointment.find({ doctor: doctor.id, patient: patientId }).sort({ startsAt: -1 });
    return serializeMany(appointments, doctor);
  }

  return {
    book,
    list,
    get,
    cancel,
    reschedule,
    complete,
    markNoShow,
    exportCursor,
    cancelForLeave,
    countBookedOn,
    listForDoctorPatient,
    serialize,
    serializeMany,
    findFor,
    context,
  };
}
