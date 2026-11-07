export const otpEmail = (code, minutes) => ({
  subject: 'Your BookMyAppointments verification code',
  text: `Your verification code is ${code}. It is valid for ${minutes} minutes.\nIf you did not request it, you can ignore this email.`,
});

export const resetEmail = (link) => ({
  subject: 'Reset your BookMyAppointments password',
  text: `Use the link below to choose a new password. It is valid for 30 minutes and works once.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
});

export const reminderEmail = ({ doctorName, date, time, timezone }) => ({
  subject: `Reminder: appointment with ${doctorName} on ${date} at ${time}`,
  text: `This is a reminder of your appointment with ${doctorName} on ${date} at ${time} (${timezone}).`,
});
