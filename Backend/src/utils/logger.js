import pino from 'pino';

export const createLogger = (level) =>
  pino({
    level,
    base: undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.refreshToken',
        '*.otp',
        '*.signature',
      ],
      censor: '[redacted]',
    },
  });
