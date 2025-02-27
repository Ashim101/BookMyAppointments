import { MongoClient } from 'mongodb';
import { mongoUri } from '../scripts/stack.mjs';

/** Runs `fn(db)` against the e2e database. Used only for what the real clock cannot do (see moveAppointmentTo). */
export async function withDb(fn) {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    return await fn(client.db());
  } finally {
    await client.close();
  }
}

const KATHMANDU = 'Asia/Kathmandu';

function wallClock(instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: KATHMANDU,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * A doctor can only complete a visit from 15 minutes before it starts, but the API refuses to book
 * anything that starts sooner than 30 minutes from now, and the real clock cannot be advanced.
 * This moves one booked appointment of a patient to 45 minutes ago, keeping the unique slot keys
 * consistent, which is exactly the state the system is in once the visit time has arrived.
 */
export async function moveBookedAppointmentToPast(patientEmail) {
  return withDb(async (db) => {
    const appointment = await db
      .collection('appointments')
      .findOne({ 'patientInfo.email': patientEmail, status: 'booked' }, { sort: { createdAt: -1 } });
    if (!appointment) throw new Error(`no booked appointment for ${patientEmail}`);
    const startsAt = new Date(Date.now() - 45 * 60_000);
    startsAt.setSeconds(0, 0);
    const { date, time } = wallClock(startsAt);
    await db.collection('appointments').updateOne(
      { _id: appointment._id },
      {
        $set: {
          date,
          time,
          startsAt,
          endsAt: new Date(startsAt.getTime() + 30 * 60_000),
          activeSlotKey: `${appointment.doctor}:${date}:${time}`,
          activePatientKey: `${appointment.patient}:${startsAt.getTime()}`,
        },
      },
    );
    return { id: String(appointment._id), date, time };
  });
}
