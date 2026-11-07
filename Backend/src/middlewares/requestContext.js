import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';

const SAFE_ID = /^[\w-]{8,64}$/;

/** Assigns a request id (echoed in `X-Request-Id`) and logs each request without bodies or credentials. */
export function createRequestContext(logger) {
  return pinoHttp({
    logger,
    genReqId: (req, res) => {
      const supplied = req.headers['x-request-id'];
      const id = typeof supplied === 'string' && SAFE_ID.test(supplied) ? supplied : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  });
}
