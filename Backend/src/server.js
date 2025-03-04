import dotenv from 'dotenv';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createLogger } from './utils/logger.js';

dotenv.config({ quiet: true });

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }

  const logger = createLogger(config.logLevel);
  await connectDatabase(config.mongoUri);
  logger.info('database connected');
  mongoose.connection.on('disconnected', () => logger.warn('database connection lost'));
  mongoose.connection.on('reconnected', () => logger.info('database connection restored'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'database error'));

  if (config.isProduction && !config.smtp) {
    logger.warn(
      'SMTP_HOST is not set: OTP and password-reset emails are discarded, so patients cannot register',
    );
  }
  const app = createApp({ config, logger });
  const { reminderJob } = app.locals.container;
  const server = app.listen(config.port, () =>
    logger.info({ port: config.port, env: config.env }, 'server listening'),
  );
  if (config.reminders.enabled) reminderJob.start();

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const forced = setTimeout(() => {
      logger.error('graceful shutdown timed out');
      process.exit(1);
    }, 15_000);
    forced.unref();
    try {
      await reminderJob.stop();
      await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      await disconnectDatabase();
      logger.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  }
  // A crashed process is restarted by its supervisor; exiting beats running in an unknown state.
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled promise rejection');
    shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    shutdown('uncaughtException');
  });
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  process.stderr.write(`Failed to start: ${err.stack ?? err}\n`);
  process.exit(1);
});
