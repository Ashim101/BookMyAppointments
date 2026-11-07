import nodemailer from 'nodemailer';

const OUTBOX_LIMIT = 100;

/**
 * Sends mail through SMTP when configured; otherwise nodemailer's jsonTransport
 * keeps messages in memory (`outbox`) and the log instead of delivering them.
 */
export function createMailer({ config, logger }) {
  const outbox = [];
  const transport = nodemailer.createTransport(
    config.smtp
      ? {
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.port === 465,
          auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
        }
      : { jsonTransport: true },
  );

  async function send({ to, subject, text }) {
    const info = await transport.sendMail({ from: config.mailFrom, to, subject, text });
    if (config.smtp) {
      logger.info({ to, subject }, 'email sent');
      return;
    }
    const message = JSON.parse(info.message);
    outbox.push({ to, subject, text: message.text });
    if (outbox.length > OUTBOX_LIMIT) outbox.shift();
    // The body is only logged at debug level so local developers can read OTPs and reset links.
    logger.info({ to, subject }, 'email captured (no SMTP configured)');
    logger.debug({ to, text }, 'email body');
  }

  return { send, outbox };
}
