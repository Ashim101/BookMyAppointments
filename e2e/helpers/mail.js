import { readFileSync } from 'node:fs';
import { backendLog } from '../scripts/stack.mjs';

/**
 * The backend runs without SMTP, so its mailer logs every message and, at debug level, the body.
 * Reading that log is how the tests obtain OTPs and reset links without any test-only code in the server.
 */
function loggedBodies(to) {
  return readFileSync(backendLog, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry?.msg === 'email body' && entry.to === to)
    .map((entry) => entry.text);
}

/** Polls the backend log until a mail to `to` matches `pattern`; returns the first capture group. */
export async function waitForMailMatch(to, pattern, { timeoutMs = 10_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const bodies = loggedBodies(to);
    for (const body of bodies.reverse()) {
      const match = pattern.exec(body);
      if (match) return match[1];
    }
    if (Date.now() > deadline) throw new Error(`No mail to ${to} matching ${pattern} in the backend log`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

export const waitForOtp = (to) => waitForMailMatch(to, /\b(\d{6})\b/);
