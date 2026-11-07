/* Seeds demo data: specialities, doctors with varied schedules and leave days, patients, and
 * appointments in every status with payments, consultations and reviews.
 * Usage: npm run seed [-- --reset] [-- --force]   (idempotent; --reset wipes application data first) */
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Appointment, patientKey, slotKey } from '../src/modules/appointments/appointment.model.js';
import { AuditLog } from '../src/modules/audit/audit.model.js';
import { Doctor } from '../src/modules/doctors/doctor.model.js';
import { generateDaySlots } from '../src/modules/scheduling/engine.js';
import { Leave } from '../src/modules/scheduling/leave.model.js';
import { Notification } from '../src/modules/notifications/notification.model.js';
import { Patient } from '../src/modules/patients/patient.model.js';
import { Payment } from '../src/modules/payments/payment.model.js';
import { Review } from '../src/modules/reviews/review.model.js';
import { SettingsDoc } from '../src/modules/settings/settings.model.js';
import { Speciality } from '../src/modules/specialities/speciality.model.js';
import { addDays, todayIn } from '../src/utils/time.js';

dotenv.config({ quiet: true });

const args = new Set(process.argv.slice(2));
const timezone = process.env.CLINIC_TIMEZONE || 'Asia/Kathmandu';
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bookmyappointments';
const DOCTOR_PASSWORD = 'Doctor@12345';
const DEMO = { email: 'demo.patient@example.com', password: 'Demo@12345', name: 'Demo Patient' };

if (process.env.NODE_ENV === 'production' && !args.has('--force')) {
  console.error('Refusing to seed a production database. Pass --force if you really mean it.');
  process.exit(1);
}

const SPECIALITIES = [
  ['General physician', 'First point of contact for everyday health concerns.'],
  ['Gynecologist', 'Women\'s reproductive and maternal health.'],
  ['Dermatologist', 'Skin, hair and nail conditions.'],
  ['Pediatrician', 'Health care for infants, children and teenagers.'],
  ['Neurologist', 'Disorders of the brain, spine and nerves.'],
  ['Gastroenterologist', 'Digestive system and liver conditions.'],
];

const weekdays = (days, start, end, breaks = [{ start: '13:00', end: '14:00' }]) => days.map((day) => ({ day, start, end, breaks }));
const MON_FRI = [1, 2, 3, 4, 5];

const DOCTORS = [
  ['Dr. Aarav Sharma', 'general-physician', 'MBBS, MD', 12, 500, 30, weekdays(MON_FRI, '10:00', '17:00'), [4]],
  ['Dr. Sita Karki', 'general-physician', 'MBBS', 6, 400, 20, weekdays([0, 1, 2, 3, 4], '09:00', '15:00', [{ start: '12:00', end: '12:40' }]), []],
  ['Dr. Maya Thapa', 'gynecologist', 'MBBS, MS (OB/GYN)', 15, 900, 30, weekdays([1, 3, 5], '11:00', '18:00'), [9]],
  ['Dr. Priya Joshi', 'gynecologist', 'MBBS, DGO', 8, 700, 45, weekdays([2, 4, 6], '10:00', '16:00', []), []],
  ['Dr. Rohan Adhikari', 'dermatologist', 'MBBS, MD (Dermatology)', 10, 800, 30, weekdays(MON_FRI, '12:00', '19:00', [{ start: '15:00', end: '15:30' }]), [6, 7]],
  ['Dr. Anita Gurung', 'dermatologist', 'MBBS, DDVL', 5, 600, 15, weekdays([1, 2, 3], '09:00', '13:00', []), []],
  ['Dr. Bikash Shrestha', 'pediatrician', 'MBBS, MD (Pediatrics)', 14, 650, 30, weekdays([0, 1, 2, 3, 4, 5], '08:00', '14:00', [{ start: '11:00', end: '11:30' }]), []],
  ['Dr. Nisha Rai', 'pediatrician', 'MBBS, DCH', 4, 450, 20, weekdays(MON_FRI, '14:00', '20:00', []), [3]],
  ['Dr. Suman Pandey', 'neurologist', 'MBBS, DM (Neurology)', 18, 1200, 60, weekdays([1, 4], '10:00', '16:00'), []],
  ['Dr. Kabita Lama', 'neurologist', 'MBBS, MD, DM', 9, 1000, 45, weekdays([2, 3, 5], '11:00', '17:00'), [10]],
  ['Dr. Dipesh Basnet', 'gastroenterologist', 'MBBS, MD, DM (Gastro)', 11, 950, 30, weekdays(MON_FRI, '09:00', '16:00'), []],
  ['Dr. Rekha Maharjan', 'gastroenterologist', 'MBBS, MD', 7, 750, 30, weekdays([1, 2, 4, 6], '10:00', '15:00', []), [5]],
];

const PRESCRIPTIONS = [
  [{ medicine: 'Paracetamol', dosage: '500mg', frequency: 'Twice daily', durationDays: 5, instructions: 'After meals' }],
  [
    { medicine: 'Amoxicillin', dosage: '250mg', frequency: 'Three times daily', durationDays: 7, instructions: 'Complete the course' },
    { medicine: 'Cetirizine', dosage: '10mg', frequency: 'Once at night', durationDays: 5, instructions: '' },
  ],
  [],
];
const COMMENTS = ['Listened carefully and explained everything.', 'Short waiting time and a clear plan.', 'Helpful, but the visit felt rushed.', 'Very professional.', ''];

async function reset() {
  for (const model of [Appointment, AuditLog, Doctor, Leave, Notification, Patient, Payment, Review, SettingsDoc, Speciality]) {
    await model.deleteMany({});
  }
  console.log('Existing application data removed.');
}

async function seedSpecialities() {
  for (const [name, description] of SPECIALITIES) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await Speciality.updateOne({ slug }, { $setOnInsert: { slug, name, description } }, { upsert: true });
  }
}

async function seedDoctors(now) {
  const passwordHash = await bcrypt.hash(DOCTOR_PASSWORD, 10);
  const today = todayIn(now, timezone);
  const doctors = [];
  for (const [index, [name, speciality, degree, experienceYears, fees, slotMinutes, weekly, leaveOffsets]] of DOCTORS.entries()) {
    const email = `${name.toLowerCase().replace(/^dr\. /, '').replace(/[^a-z]+/g, '.')}@clinic.example.com`;
    let doctor = await Doctor.findOne({ email });
    if (!doctor) {
      doctor = await Doctor.create({
        name,
        email,
        passwordHash,
        speciality,
        degree,
        experienceYears,
        about: `${name} has ${experienceYears} years of experience and sees patients by appointment.`,
        fees,
        currency: process.env.CURRENCY || 'INR',
        address: { line1: `${10 + index} Health Avenue`, line2: 'Clinic Block', city: 'Kathmandu' },
        schedule: { slotMinutes, weekly },
      });
    }
    for (const offset of leaveOffsets) {
      await Leave.updateOne({ doctor: doctor._id, date: addDays(today, offset) }, { $setOnInsert: { reason: 'Annual leave' } }, { upsert: true });
    }
    doctors.push(doctor);
  }
  return doctors;
}

async function seedPatients() {
  const passwordHash = await bcrypt.hash(DEMO.password, 10);
  const names = ['Hari Bhandari', 'Gita Neupane', 'Ramesh Acharya', 'Sunita Tamang', 'Prakash Oli', 'Laxmi Dahal', 'Binod Khadka'];
  const people = [{ name: DEMO.name, email: DEMO.email, phone: '+977 9800000001', gender: 'other' }];
  names.forEach((name, i) => people.push({ name, email: `seed.patient${i + 1}@example.com`, phone: `+977 98000001${i}0`, gender: i % 2 ? 'female' : 'male' }));
  const patients = [];
  for (const person of people) {
    patients.push(
      (await Patient.findOne({ email: person.email })) ??
        (await Patient.create({ ...person, passwordHash, dob: '1992-04-15', address: { line1: '21 Lake Road', line2: '', city: 'Pokhara' } })),
    );
  }
  return patients;
}

/** Deterministic pseudo-random sequence so repeated seeds produce the same shape of data. */
const lcg = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

async function seedAppointments({ doctors, patients, now }) {
  if (await Appointment.exists({ patient: { $in: patients.map((p) => p._id) } })) {
    console.log('Appointments already seeded; skipping.');
    return;
  }
  const specialities = new Map((await Speciality.find()).map((s) => [s.slug, s.name]));
  const leaves = new Map();
  for (const leave of await Leave.find({ doctor: { $in: doctors.map((d) => d._id) } })) {
    leaves.set(`${leave.doctor}:${leave.date}`, true);
  }
  const random = lcg(42);
  const today = todayIn(now, timezone);
  const usedSlots = new Set();
  const usedPatientTimes = new Set();
  let created = 0;

  for (let i = 0; i < 64; i += 1) {
    const doctor = doctors[i % doctors.length];
    const patient = patients[i < 12 ? 0 : (i * 3) % patients.length];
    const offset = Math.floor(random() * 36) - 22;
    const status = pickStatus(offset, i);
    const slot = findSlot({ doctor, patient, offset, today, leaves, usedSlots, usedPatientTimes });
    if (!slot) continue;

    const paid = status === 'completed' ? i % 5 !== 0 : status === 'booked' ? i % 2 === 0 : status === 'cancelled' ? i % 3 !== 0 : i % 4 === 0;
    const cancelledBy = ['patient', 'doctor', 'admin'][i % 3];
    const refunded = status === 'cancelled' && paid;
    const holdsSlot = status === 'booked' || status === 'completed';
    const orderId = `mock_order_seed_${i}`;

    const appointment = await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      patientInfo: { name: patient.name, email: patient.email, phone: patient.phone, gender: patient.gender, dob: patient.dob },
      doctorInfo: { name: doctor.name, speciality: doctor.speciality, specialityName: specialities.get(doctor.speciality), address: doctor.address },
      date: slot.date,
      time: slot.time,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      timezone,
      reason: ['Routine check-up', 'Follow-up visit', 'Persistent cough', 'Skin rash', 'Headache for a week'][i % 5],
      fee: doctor.fees,
      currency: doctor.currency,
      status,
      paymentStatus: paid ? (refunded ? (i % 2 ? 'refunded' : 'refund_pending') : 'paid') : 'unpaid',
      payment: paid ? { orderId, paymentId: `mock_pay_seed_${i}`, paidAt: new Date(slot.startsAt - 86_400_000) } : undefined,
      cancellation: status === 'cancelled' ? { by: cancelledBy, reason: 'Schedule conflict', at: new Date(Math.min(now, slot.startsAt - 3_600_000 * 5)) } : null,
      consultation: status === 'completed'
        ? { notes: 'Examined the patient; advised rest and fluids.', prescription: PRESCRIPTIONS[i % PRESCRIPTIONS.length], completedAt: new Date(slot.endsAt) }
        : null,
      activeSlotKey: holdsSlot ? slotKey(doctor._id, slot.date, slot.time) : undefined,
      activePatientKey: holdsSlot ? patientKey(patient._id, new Date(slot.startsAt)) : undefined,
    });
    created += 1;

    if (paid) {
      await Payment.create({
        appointment: appointment._id,
        provider: 'mock',
        orderId,
        paymentId: `mock_pay_seed_${i}`,
        amount: doctor.fees,
        currency: doctor.currency,
        status: refunded && i % 2 ? 'refunded' : 'paid',
      });
    }
    if (status === 'completed' && i % 3 !== 0) await addReview(appointment, patient, doctor, i);
  }
  await refreshRatings();
  await seedNotifications(patients[0], now);
  console.log(`Created ${created} appointments.`);
}

function pickStatus(offset, i) {
  if (offset < 0) return ['completed', 'completed', 'completed', 'no_show', 'cancelled'][i % 5];
  return ['booked', 'booked', 'booked', 'cancelled'][i % 4];
}

function findSlot({ doctor, patient, offset, today, leaves, usedSlots, usedPatientTimes }) {
  for (let step = 0; step < 21; step += 1) {
    const date = addDays(today, offset + step);
    if (leaves.has(`${doctor._id}:${date}`)) continue;
    const slots = generateDaySlots({ date, schedule: doctor.toObject().schedule, timezone, now: 0, windowDays: 0 });
    for (const slot of slots) {
      const key = `${doctor._id}:${date}:${slot.time}`;
      const patientTime = `${patient._id}:${slot.startsAt}`;
      if (usedSlots.has(key) || usedPatientTimes.has(patientTime)) continue;
      usedSlots.add(key);
      usedPatientTimes.add(patientTime);
      return { ...slot, date };
    }
  }
  return null;
}

async function addReview(appointment, patient, doctor, i) {
  const rating = [5, 5, 4, 4, 3, 5, 2][i % 7];
  const comment = COMMENTS[i % COMMENTS.length];
  await Review.create({
    appointment: appointment._id,
    doctor: doctor._id,
    patient: patient._id,
    patientName: patient.name,
    patientImage: patient.image,
    doctorName: doctor.name,
    rating,
    comment,
  });
  await Appointment.updateOne({ _id: appointment._id }, { $set: { review: { rating, comment, createdAt: appointment.endsAt } } });
}

async function refreshRatings() {
  const stats = await Review.aggregate([{ $group: { _id: '$doctor', average: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  for (const row of stats) {
    await Doctor.updateOne({ _id: row._id }, { $set: { rating: { average: Math.round(row.average * 100) / 100, count: row.count } } });
  }
}

async function seedNotifications(patient, now) {
  if (await Notification.exists({ userId: String(patient._id) })) return;
  const base = { userId: String(patient._id), role: 'patient' };
  await Notification.insertMany([
    { ...base, type: 'appointment_reminder', title: 'Appointment reminder', message: 'You have an upcoming appointment tomorrow.', createdAt: new Date(now - 3_600_000) },
    { ...base, type: 'payment_received', title: 'Payment received', message: 'Your payment was received.', read: true, createdAt: new Date(now - 86_400_000) },
  ]);
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  if (args.has('--reset')) await reset();

  const now = Date.now();
  await seedSpecialities();
  const doctors = await seedDoctors(now);
  const patients = await seedPatients();
  await seedAppointments({ doctors, patients, now });

  console.log('\nSeed complete.');
  console.log(`  Demo patient : ${DEMO.email} / ${DEMO.password}`);
  console.log(`  Doctors      : ${doctors[0].email} / ${DOCTOR_PASSWORD}  (all ${doctors.length} doctors share this password)`);
  console.log('  Admin        : ADMIN_EMAIL / the password you hashed into ADMIN_PASSWORD_HASH');
  console.log(`  Clinic zone  : ${timezone}`);
}

try {
  await main();
} catch (err) {
  console.error('Seeding failed:', err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
