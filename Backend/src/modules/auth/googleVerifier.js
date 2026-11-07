import { OAuth2Client } from 'google-auth-library';

/** Returns a verifier for Google ID tokens, or null when Google sign-in is not configured. */
export function createGoogleVerifier({ config }) {
  if (!config.googleClientId) return null;
  const client = new OAuth2Client(config.googleClientId);
  return async function verify(credential) {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    const payload = ticket.getPayload();
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.email,
      picture: payload.picture ?? null,
    };
  };
}
