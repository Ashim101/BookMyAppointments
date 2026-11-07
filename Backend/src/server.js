import dotenv from 'dotenv';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
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

  const app = createApp({ config, logger });
  const { reminderJob } = app.locals.container;
  const server = app.listen(config.port, () => logger.info({ port: config.port, env: config.env }, 'server listening'));
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
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  process.stderr.write(`Failed to start: ${err.stack ?? err}\n`);
  process.exit(1);
});
