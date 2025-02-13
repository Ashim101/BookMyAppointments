import jwt from 'jsonwebtoken';
import { AppError, unauthorized } from '../utils/AppError.js';

/**
 * Verifies the bearer access token and loads the principal behind it, so a
 * blocked patient or deactivated doctor loses access immediately rather than
 * when the access token expires.
 */
export function createAuthenticate({ config, loadPrincipal }) {
  return async function authenticate(req, _res, next) {
    try {
      const header = req.headers.authorization ?? '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) throw unauthorized();

      let payload;
      try {
        payload = jwt.verify(token, config.jwt.accessSecret, { algorithms: ['HS256'] });
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) throw new AppError('TOKEN_EXPIRED', 'Access token expired');
        throw unauthorized('Invalid access token');
      }

      const principal = await loadPrincipal(payload.role, payload.sub);
      if (!principal) throw unauthorized('Account no longer exists');
      req.user = principal;
      next();
    } catch (err) {
      next(err);
    }
  };
}
