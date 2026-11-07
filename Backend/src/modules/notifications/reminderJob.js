import { Appointment } from '../appointments/appointment.model.js';
import { reminderEmail } from './templates.js';

const MAX_PER_RUN = 500;

/**
 * Interval scheduler that sends each appointment reminder at most once.
 * Appointments are claimed with an atomic findOneAndUpdate on `reminderSentAt: null`,
 * so several server instances can run the job without duplicating reminders.
 */
export function createReminderJob({ config, clock, mailer, notifications, logger }) {
  let timer = null;
  let running = false;
  let lastRunAt = null;

  async function remind(appointment) {
    await notifications.notify(
      { id: appointment.patient, role: 'patient' },
      {
        type: 'appointment_reminder',
        title: 'Appointment reminder',
        message: `You have an appointment with ${appointment.doctorInfo.name} on ${appointment.date} at ${appointment.time}.`,
        link: `/appointments/${appointment._id}`,
      },
    );
    await mailer
      .send({
        to: appointment.patientInfo.email,
        ...reminderEmail({
          doctorName: appointment.doctorInfo.name,
          date: appointment.date,
          time: appointment.time,
          timezone: appointment.timezone,
        }),
      })
      .catch((err) => logger.error({ err, appointmentId: String(appointment._id) }, 'reminder email failed'));
  }

  async function runOnce(now = new Date(clock.now())) {
    const horizon = new Date(now.getTime() + config.reminders.leadHours * 3_600_000);
    let sent = 0;
    while (sent < MAX_PER_RUN) {
      const claimed = await Appointment.findOneAndUpdate(
        { status: 'booked', reminderSentAt: null, startsAt: { $gt: now, $lte: horizon } },
        { $set: { reminderSentAt: now } },
        { sort: { startsAt: 1 }, returnDocument: 'after' },
      );
      if (!claimed) break;
      await remind(claimed);
      sent += 1;
    }
    lastRunAt = now;
    return sent;
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      const sent = await runOnce();
      if (sent > 0) logger.info({ sent }, 'appointment reminders sent');
    } catch (err) {
      logger.error({ err }, 'reminder job failed');
    } finally {
      running = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(tick, config.reminders.intervalMs);
    timer.unref();
    tick();
  }

  async function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    while (running) await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const status = () => ({ running: timer !== null, lastRunAt: lastRunAt?.toISOString() ?? null });

  return { start, stop, runOnce, status };
}
