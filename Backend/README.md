# BookMyAppointments API

Express 5 + MongoDB (Mongoose 9) backend for the patient app and the staff (admin and doctor) app.
The binding contract for every endpoint, shape and error code is [`docs/API.md`](../docs/API.md).

## Setup

Requires Node 20 and a MongoDB 6+ server.

```bash
cd Backend
npm install
cp .env.example .env          # then fill in the two JWT secrets, the admin credentials and the encryption key
openssl rand -hex 32          # use for JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
npm run hash-password -- 'YourAdminPassword1'   # paste the output into ADMIN_PASSWORD_HASH
npm run generate-key          # paste into DATA_ENCRYPTION_KEYS and set DATA_ENCRYPTION_ACTIVE_KEY_ID to its id
npm run seed                  # optional demo data
npm run dev                   # http://localhost:4000/api/health
```

The server validates its environment with zod on start-up and exits with a readable list of problems. With
`NODE_ENV=production` it additionally refuses placeholder, short or identical JWT secrets, a missing
`ADMIN_EMAIL`/`ADMIN_PASSWORD_HASH`, unset `CORS_ORIGINS`, and any `PAYMENTS_MODE` other than `razorpay` (with
all three `RAZORPAY_*` values). The data-encryption key ring is required in every environment.
Optional integrations degrade cleanly: without Cloudinary, images go to `uploads/` and are served at
`/uploads`; without SMTP, emails use nodemailer's `jsonTransport` and are logged (the body only at
`debug` level outside production, so OTPs and reset links are visible while developing and never in production); without a Google client id
`POST /auth/google` answers `400 BAD_REQUEST`; `PAYMENTS_MODE=mock` needs no keys but only works outside production.

### Demo data

`npm run seed` is idempotent (`-- --reset` wipes application data first). It creates 6 specialities, 12 doctors
with different schedules and leave days, 8 patients, and about 60 appointments in every status with payments,
consultations and reviews.

| Account          | Email                                  | Password                |
| ---------------- | -------------------------------------- | ----------------------- |
| Demo patient     | `demo.patient@example.com`             | `Demo@12345`            |
| Doctors (all 12) | e.g. `aarav.sharma@clinic.example.com` | `Doctor@12345`          |
| Admin            | `ADMIN_EMAIL`                          | the password you hashed |

## Scripts

| Script                                | Purpose                                         |
| ------------------------------------- | ----------------------------------------------- |
| `npm run dev`                         | nodemon on `src/server.js`                      |
| `npm start`                           | run the server                                  |
| `npm test` / `npm run test:coverage`  | Vitest + supertest, optionally with v8 coverage |
| `npm run lint`                        | ESLint flat config, zero warnings allowed       |
| `npm run seed`                        | demo data                                       |
| `npm run hash-password -- <password>` | bcrypt hash for `ADMIN_PASSWORD_HASH`           |
| `npm run generate-key [-- <keyId>]`   | new entry for `DATA_ENCRYPTION_KEYS`            |
| `npm run encrypt-existing`            | encrypt legacy plaintext and rotate keys        |

Tests need a real MongoDB. By default `mongodb-memory-server` downloads and starts one. To use your own
(for example `docker run -d --rm -p 27018:27017 mongo:7`), set `MONGODB_URI_TEST=mongodb://127.0.0.1:27018`;
every test file gets its own throwaway database.

## Environment variables

See `.env.example` for the full, commented list. The important ones:

| Variable                                                                                                  | Meaning                                                                     |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `MONGODB_URI`, `PORT`, `NODE_ENV`                                                                         | basics                                                                      |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`                                                                 | required, at least 16 characters; the refresh secret also keys the OTP hash |
| `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL_DAYS`                                                              | token lifetimes (15m / 7 days)                                              |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`                                                                      | the single admin account (bcrypt hash)                                      |
| `CORS_ORIGINS`                                                                                            | comma-separated allow-list of browser origins                               |
| `CLINIC_TIMEZONE`, `CURRENCY`, `CANCELLATION_CUTOFF_HOURS`, `BOOKING_WINDOW_DAYS`, `DEFAULT_SLOT_MINUTES` | clinic defaults; the admin settings document overrides all but the timezone |
| `DATA_ENCRYPTION_KEYS`, `DATA_ENCRYPTION_ACTIVE_KEY_ID`                                                   | required: key ring (`keyId:base64key`, 32-byte keys) and the key for writes |
| `PAYMENTS_MODE`, `RAZORPAY_*`                                                                             | `mock` (not in production) or `razorpay` (keys required in that mode)       |
| `REMINDERS_ENABLED`, `REMINDER_INTERVAL_MINUTES`, `REMINDER_LEAD_HOURS`                                   | background job                                                              |
| `API_RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, `LOGIN_MAX_FAILURES`, `LOGIN_LOCKOUT_MINUTES`                    | per-IP limits on `/api` and `/api/auth/*`, per-account lockout              |

## Layout

```
src/
  app.js            createApp({ config, logger?, overrides? }) builds the Express app, no listening
  server.js         connects, listens, starts the job, graceful shutdown on SIGINT/SIGTERM
  container.js      wires services; clock, mailer, payments, storage and Google can be overridden
  config/           env.js (zod), db.js
  middlewares/      authenticate, authorize, validate, errorHandler, rate limiters, upload,
                    requestContext (request id + logging), audit, idempotency, cache
  utils/            AppError, asyncHandler, pagination, crypto, csv, time, logger, schemas
  modules/<domain>/ model, service, controller, routes, validators (as needed)
    auth patients doctors specialities scheduling appointments payments reviews
    notifications admin analytics audit settings health uploads
scripts/            seed.js, hash-password.js
tests/              unit/ and integration/ (Vitest + supertest)
```

Controllers are thin; services own the business rules; routes only wire middleware.
Every response uses the `{ success, data }` / `{ success: false, error }` envelope.

## Slots and booking

- **Time zones.** `utils/time.js` converts between wall-clock time in an IANA zone and UTC instants using
  `Intl.DateTimeFormat` only. A wall time that does not exist (spring-forward gap) yields no slot; one that
  occurs twice (fall-back) resolves to the first occurrence. Unit tests cover `Asia/Kathmandu` (+05:45) and the
  `America/New_York` transitions on 2026-03-08 and 2026-11-01.
- **Engine.** `modules/scheduling/engine.js` is pure: weekly schedule, breaks, leave days, existing bookings,
  `now`, the booking window and the 30-minute lead produce the slot list. `scheduling.service.js` loads the
  inputs. Appointments store `date`/`time` (clinic wall clock) plus `startsAt`/`endsAt` (UTC).
- **No double booking.** An appointment that holds a slot (`booked`, `completed`) carries
  `activeSlotKey = doctor:date:time` and `activePatientKey = patient:startsAt`, each under a partial unique
  index. Cancelling or marking no-show `$unset`s both keys. Concurrent requests race on the index: one wins,
  the rest get `409 SLOT_TAKEN` (or `409 CONFLICT` when the patient already holds that time). Rescheduling
  swaps both keys in one atomic `findOneAndUpdate`, so it cannot lose a race either.
- **State machine.** `appointments/stateMachine.js` holds the transition table plus per-action checks (role,
  ownership, cancellation cutoff, 2 reschedules, completion from 15 minutes before the start, no-show after it).
  The same checks produce the `actions` flags. Looking up an appointment you do not own is a `404`.
  Cancelling a paid appointment sets `refund_pending`; the mock provider (or a Razorpay `processed` refund)
  completes it immediately, otherwise the `refund.processed` webhook does, and the background job retries refunds
  whose provider call failed.
- **Reminders.** `notifications/reminderJob.js` claims due appointments with
  `findOneAndUpdate({ reminderSentAt: null, ... })`, so each reminder is sent at most once across instances.
  `runOnce(now)` is exported for tests.

## Tokens

- Access token: HS256 JWT with only `sub` and `role`, 15 minutes by default. `authenticate` also loads the
  account, so blocking a patient or deactivating a doctor takes effect immediately (`403 ACCOUNT_BLOCKED`).
  Expired tokens answer `401 TOKEN_EXPIRED`; everything else is `401 UNAUTHORIZED`.
- Refresh token: opaque 48-byte random string, stored as a SHA-256 hash, rotated on every use with an atomic
  `findOneAndUpdate`. Presenting an already-rotated token revokes every refresh token of that account.
  Blocking, deactivating, logging out and password resets revoke tokens too.
- OTPs and password-reset tokens are stored hashed, are single use, and expire (10 and 30 minutes).
  OTPs come from `crypto.randomInt`, allow 5 attempts and a 60-second resend cooldown.
- Passwords use bcrypt; signature checks use `crypto.timingSafeEqual`.

## Payments

`modules/payments/providers.js` exposes one interface (`createOrder`, `verifyPayment`, `verifyWebhook`, `refund`)
with a mock and a Razorpay implementation. The webhook route is mounted before the JSON parser and verifies the
HMAC-SHA256 signature over the raw body. All webhook transitions are conditional updates, so replays are no-ops.

The mock provider additionally throws from `createOrder`, `verifyPayment` and `refund` whenever
`NODE_ENV=production`, and production configuration validation rejects `PAYMENTS_MODE=mock` outright.

## Data encryption

`reason`, `consultation.notes` and `consultation.prescription` of an appointment are encrypted by the Mongoose
types in `src/utils/encryptedFields.js` (setters encrypt, getters decrypt), so services and DTOs see plaintext and
MongoDB sees `enc:v1:<keyId>:<iv>:<tag>:<data>` (AES-256-GCM, random 12-byte IV, base64url parts; the prescription
list is stored as encrypted JSON). `src/utils/fieldCrypto.js` holds the key ring and the cipher; the container
installs it at start-up. Consequences for code in this repository:

- Query these fields only through the model. They cannot be filtered or sorted in MongoDB, and aggregations see ciphertext.
- Length limits for them live in the request validators (the stored text is longer than the input).
- Never copy them into logs, audit entries, notifications or emails. The audit middleware drops `notes` and `prescription`.
- `scripts/encrypt-existing.js` works on the raw collection, because the model refuses plaintext. It encrypts what is
  still plaintext and re-encrypts anything under a non-active key id; running it twice changes nothing.

## Notes

- The refund retry sweep runs inside the reminder job, so `REMINDERS_ENABLED=false` also disables it.
- `POST /appointments` honours an optional `Idempotency-Key` header (8 to 64 characters, kept for 24 hours).
- Audit logs are kept for 400 days and notifications for 120 days (TTL indexes).
