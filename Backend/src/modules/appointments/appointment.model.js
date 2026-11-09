import mongoose from 'mongoose';
import { encryptedList, encryptedText } from '../../utils/encryptedFields.js';
import { addressDefinition } from '../../utils/schemas.js';

const { ObjectId } = mongoose.Schema.Types;
const addressSchema = new mongoose.Schema(addressDefinition, { _id: false });

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: ObjectId, ref: 'Patient', required: true },
    doctor: { type: ObjectId, ref: 'Doctor', required: true },
    patientInfo: {
      name: String,
      image: { type: String, default: null },
      email: String,
      phone: { type: String, default: '' },
      gender: { type: String, default: 'unspecified' },
      dob: { type: String, default: null },
    },
    doctorInfo: {
      name: String,
      image: { type: String, default: null },
      speciality: String,
      specialityName: String,
      address: { type: addressSchema, default: () => ({}) },
    },
    date: { type: String, required: true },
    time: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    timezone: { type: String, required: true },
    reason: encryptedText,
    fee: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    status: { type: String, enum: ['booked', 'completed', 'cancelled', 'no_show'], default: 'booked' },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refund_pending', 'refunded'],
      default: 'unpaid',
    },
    payment: {
      orderId: String,
      paymentId: String,
      paidAt: Date,
      refundId: String,
      refundedAt: Date,
      refundAttemptAt: Date,
    },
    cancellation: {
      type: new mongoose.Schema(
        {
          by: { type: String, enum: ['patient', 'doctor', 'admin'] },
          reason: { type: String, default: '' },
          at: Date,
        },
        { _id: false },
      ),
      default: null,
    },
    consultation: {
      type: new mongoose.Schema(
        {
          notes: encryptedText,
          prescription: encryptedList,
          completedAt: Date,
        },
        { _id: false },
      ),
      default: null,
    },
    review: {
      type: new mongoose.Schema(
        { rating: Number, comment: { type: String, default: '' }, createdAt: Date },
        { _id: false },
      ),
      default: null,
    },
    rescheduleCount: { type: Number, default: 0 },
    reminderSentAt: { type: Date, default: null },
    // Unique while the appointment holds its slot; unset on cancel/no_show so the slot can be rebooked.
    activeSlotKey: String,
    activePatientKey: String,
  },
  { timestamps: true },
);

appointmentSchema.index(
  { activeSlotKey: 1 },
  { unique: true, partialFilterExpression: { activeSlotKey: { $type: 'string' } } },
);
appointmentSchema.index(
  { activePatientKey: 1 },
  { unique: true, partialFilterExpression: { activePatientKey: { $type: 'string' } } },
);
appointmentSchema.index({ patient: 1, startsAt: -1 });
appointmentSchema.index({ doctor: 1, startsAt: -1 });
appointmentSchema.index({ status: 1, reminderSentAt: 1, startsAt: 1 });
appointmentSchema.index({ doctor: 1, date: 1, status: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);

export const slotKey = (doctorId, date, time) => `${doctorId}:${date}:${time}`;
export const patientKey = (patientId, startsAt) => `${patientId}:${startsAt.getTime()}`;
