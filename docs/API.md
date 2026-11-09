# BookMyAppointments API (v1)

This document is the contract between the backend (`Backend/`), the patient app (`Book-My-Appointment/`) and the staff app (`admin/`, used by admins and doctors). All three must follow it exactly.

## Conventions

- Base URL: `${VITE_API_URL}/api` (backend default port `4000`). All bodies are JSON unless marked *multipart*.
- Authentication: `Authorization: Bearer <accessToken>`.
- Dates are `YYYY-MM-DD` and times are `HH:mm` (24-hour), both in the clinic timezone. Instants are ISO 8601 UTC strings (`startsAt`, `createdAt`).
- Money is a number in major currency units (for example `500` means 500.00). `currency` is an ISO code (`INR`).
- IDs are strings and are always exposed as `id`, never `_id`.
- Week days are numbered `0`=Sunday through `6`=Saturday.

### Response envelope

Success:

```json
{ "success": true, "data": <payload> }
```

Error (with the matching HTTP status):

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "details": [{ "path": "email", "message": "Invalid email" }] } }
```

| HTTP | `error.code` values |
|---|---|
| 400 | `VALIDATION_ERROR`, `BAD_REQUEST` |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `ACCOUNT_BLOCKED` |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT`, `SLOT_TAKEN`, `EMAIL_TAKEN`, `ALREADY_REVIEWED` |
| 422 | `INVALID_STATE`, `OTP_INVALID`, `OTP_EXPIRED`, `PAYMENT_INVALID`, `SLOT_UNAVAILABLE`, `CANCELLATION_WINDOW_PASSED` |
| 429 | `RATE_LIMITED`, `OTP_COOLDOWN` |
| 500 | `INTERNAL` |

### Pagination

List endpoints accept `page` (default 1) and `limit` (default 10, max 100) and return:

```json
{ "items": [], "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
```

## Shared shapes

```ts
type Role = 'patient' | 'doctor' | 'admin'
type AuthUser = { id: string; name: string; email: string; role: Role; image: string | null }
type AuthTokens = { accessToken: string; refreshToken: string; user: AuthUser }

type Address = { line1: string; line2: string; city: string }

type Speciality = { id: string; slug: string; name: string; description: string; doctorCount: number }

type DoctorPublic = {
  id: string; name: string; image: string | null
  speciality: string            // slug
  specialityName: string
  degree: string; experienceYears: number; about: string
  fees: number; currency: string
  available: boolean            // accepting bookings
  address: Address
  rating: { average: number; count: number }   // average rounded to 1 decimal, 0 when count = 0
}
type DoctorAdmin = DoctorPublic & { email: string; active: boolean; createdAt: string; schedule: Schedule }

type TimeRange = { start: string; end: string }                  // HH:mm, start < end
type Schedule = {
  slotMinutes: 15 | 20 | 30 | 45 | 60
  weekly: { day: number; start: string; end: string; breaks: TimeRange[] }[]   // at most one entry per day
}
type Leave = { id: string; date: string; reason: string }

type Patient = {
  id: string; name: string; email: string; image: string | null
  phone: string; gender: 'male' | 'female' | 'other' | 'unspecified'; dob: string | null
  address: Address; blocked: boolean; createdAt: string
}

type AppointmentStatus = 'booked' | 'completed' | 'cancelled' | 'no_show'
type PaymentStatus = 'unpaid' | 'paid' | 'refund_pending' | 'refunded'
type PrescriptionItem = { medicine: string; dosage: string; frequency: string; durationDays: number; instructions: string }

type Appointment = {
  id: string
  patient: { id: string; name: string; image: string | null; email: string; phone: string; gender: string; dob: string | null }
  doctor: { id: string; name: string; image: string | null; speciality: string; specialityName: string; address: Address }
  date: string; time: string; startsAt: string; endsAt: string; timezone: string
  reason: string
  fee: number; currency: string
  status: AppointmentStatus
  paymentStatus: PaymentStatus
  cancellation: { by: Role; reason: string; at: string } | null
  consultation: { notes: string; prescription: PrescriptionItem[]; completedAt: string } | null
  review: { rating: number; comment: string; createdAt: string } | null
  rescheduleCount: number
  createdAt: string
  // computed for the requesting user
  actions: { canCancel: boolean; canReschedule: boolean; canPay: boolean; canReview: boolean; canComplete: boolean; canMarkNoShow: boolean }
}

type Review = { id: string; rating: number; comment: string; createdAt: string; patient: { id: string; name: string; image: string | null }; doctor: { id: string; name: string } }
type Notification = { id: string; type: string; title: string; message: string; link: string | null; read: boolean; createdAt: string }
type Settings = { cancellationCutoffHours: number; bookingWindowDays: number; defaultSlotMinutes: number; currency: string; timezone: string }
```

## Business rules (enforced by the backend)

1. **Slots** are generated from the doctor's weekly schedule (minus breaks), in steps of `slotMinutes`, in the clinic timezone. A slot is offered only if it is fully inside working hours and outside breaks, the date is not a leave day, the date is within `bookingWindowDays` from today, it starts at least 30 minutes from now, and no active appointment (`booked` or `completed`) holds it. Slot generation must handle timezone offsets and DST correctly.
2. **No double booking**: a database unique index guarantees that at most one active appointment exists per doctor, date and time, even under concurrent requests. A losing request gets `409 SLOT_TAKEN`. A patient also cannot hold two active appointments at the same date and time.
3. **Booking** requires an active, `available` doctor, a non-blocked patient and a slot that is currently offered (`422 SLOT_UNAVAILABLE` otherwise). The fee and the doctor and patient details are snapshotted onto the appointment.
4. **State machine**: `booked → completed | cancelled | no_show`. All other transitions return `422 INVALID_STATE`.
   - Patients may cancel or reschedule their own `booked` appointments until `cancellationCutoffHours` before the start. Later attempts return `422 CANCELLATION_WINDOW_PASSED`. At most 2 reschedules per appointment.
   - Doctors may cancel their own `booked` appointments at any time before the start, mark them `completed` (with consultation notes and an optional prescription) from 15 minutes before the start onward, and mark them `no_show` after the start.
   - Admins may cancel any `booked` appointment.
   - Cancelling a `paid` appointment sets `paymentStatus` to `refund_pending`. In `mock` payment mode the refund completes immediately (`refunded`).
5. **Payments**: only `booked` + `unpaid` appointments can be paid, and only by their patient. Razorpay signatures are verified with HMAC-SHA256 (`orderId|paymentId` keyed with the key secret), and webhooks with the webhook secret over the raw body. Webhooks are idempotent.
6. **Reviews**: one review per `completed` appointment, by its patient, with `rating` 1–5 and `comment` up to 1000 characters. The doctor's rating aggregate is recomputed on create and delete.
7. **OTP registration**: a 6-digit code from a cryptographic RNG, stored hashed, valid 10 minutes, at most 5 verification attempts, 60-second resend cooldown (`429 OTP_COOLDOWN`). `POST /auth/register` verifies the OTP itself, so registration without a valid OTP is impossible.
8. **Tokens**: access token JWT (`sub`, `role`; default lifetime 15 minutes) and a refresh token (opaque random string, stored hashed, rotated on every refresh). Reusing a revoked refresh token revokes all of that user's refresh tokens. Expired access tokens return `401 TOKEN_EXPIRED`. Blocked patients and inactive doctors cannot log in or refresh (`403 ACCOUNT_BLOCKED`).
9. **Rate limits**: `/auth/*` is limited per IP (`429 RATE_LIMITED`).
10. **Notifications** are created for the other party on booking, cancellation and reschedule, for the patient on completion (prescription ready) and payment, and as appointment reminders sent by a background job `REMINDER_LEAD_HOURS` before the start. The job runs every `REMINDER_INTERVAL_MINUTES`, claims each appointment atomically so that a reminder is sent at most once even with several server instances, and also emails the patient.
11. **Audit log**: every admin write action and every doctor appointment state change is recorded.
12. Password hashes, refresh tokens and OTP hashes are never returned by any endpoint. Public doctor endpoints never return email addresses.

## Endpoints

Legend: 🔓 public · 🧑 patient · 🩺 doctor · 🛡 admin.

### Health
- `GET /health` 🔓 → `{ status: 'ok', db: 'up' | 'down', uptime: number }`

### Auth
- `POST /auth/otp/request` 🔓 `{ email }` → `{ expiresInSeconds: 600, resendAfterSeconds: 60 }`. Returns `409 EMAIL_TAKEN` if a patient with that email exists.
- `POST /auth/register` 🔓 `{ name, email, password, otp }` → `AuthTokens` (role `patient`). The password needs at least 8 characters, including a letter and a digit.
- `POST /auth/login` 🔓 `{ email, password, role }` → `AuthTokens`. `role` is `patient`, `doctor` or `admin`. Admin credentials come from `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`.
- `POST /auth/google` 🔓 `{ credential }` → `AuthTokens` (patient; account created on first sign-in).
- `POST /auth/refresh` 🔓 `{ refreshToken }` → `AuthTokens`.
- `POST /auth/logout` 🔓 `{ refreshToken }` → `null`.
- `POST /auth/password/forgot` 🔓 `{ email, role }` (`patient` or `doctor`) → `null`. Always succeeds, so callers cannot learn which emails exist. Emails a link to `<app url>/reset-password?token=…&role=…`, where `<app url>` is `APP_URL_PATIENT` for patients and `APP_URL_ADMIN` for doctors (there is no single `APP_URL`).
- `POST /auth/password/reset` 🔓 `{ token, password }` → `null`. The token is single-use and valid for 30 minutes; all refresh tokens for the account are revoked.
- `GET /auth/me` 🧑🩺🛡 → `AuthUser`.

### Public settings
- `GET /settings/public` 🔓 → `{ cancellationCutoffHours: number; bookingWindowDays: number; timezone: string; currency: string }`. The clinic policy that clients display: the patient app uses it for the cancellation policy text and deadline and to limit slot navigation to the booking window. Never cached by the server, so admin changes show up immediately.

### Specialities
- `GET /specialities` 🔓 → `Speciality[]`, sorted by name.

### Doctors (public)
- `GET /doctors` 🔓 query: `speciality`, `search` (name), `minFee`, `maxFee`, `available` (`true`), `sort` (`rating` | `fees_asc` | `fees_desc` | `experience` | `name`), `page`, `limit` → `Paginated<DoctorPublic>`. Only active doctors.
- `GET /doctors/:id` 🔓 → `DoctorPublic`.
- `GET /doctors/:id/slots` 🔓 query: `from` (date, default today), `days` (1–14, default 7) → `{ timezone: string; slotMinutes: number; days: { date: string; weekday: number; slots: { time: string; available: boolean }[] }[] }`. Days with no working hours, and leave days, have an empty `slots` array.
- `GET /doctors/:id/reviews` 🔓 query: `page`, `limit` → `Paginated<Review>`.

### Patient profile
- `GET /patient/profile` 🧑 → `Patient`.
- `PATCH /patient/profile` 🧑 *multipart*: `name`, `phone`, `gender`, `dob`, `address` (JSON string), `image` (file, jpeg/png/webp, max 2 MB) → `Patient`.

### Appointments
- `POST /appointments` 🧑 `{ doctorId, date, time, reason? }` → `Appointment` (201).
- `GET /appointments` 🧑🩺🛡 query: `status`, `from`, `to`, `doctorId` (admin), `patientId` (admin, doctor), `scope` (`upcoming` | `past`), `page`, `limit` → `Paginated<Appointment>`. Patients see only their own, doctors see only theirs, admins see everything. `upcoming` sorts ascending by start; everything else sorts descending.
- `GET /appointments/:id` 🧑🩺🛡 → `Appointment` (with the same ownership rules; otherwise `404`).
- `PATCH /appointments/:id/cancel` 🧑🩺🛡 `{ reason }` → `Appointment`.
- `PATCH /appointments/:id/reschedule` 🧑 `{ date, time }` → `Appointment`.
- `PATCH /appointments/:id/complete` 🩺 `{ notes, prescription: PrescriptionItem[] }` → `Appointment`.
- `PATCH /appointments/:id/no-show` 🩺 → `Appointment`.
- `POST /appointments/:id/review` 🧑 `{ rating, comment }` → `Appointment`.

### Payments
- `POST /payments/order` 🧑 `{ appointmentId }` → `{ mode: 'mock' | 'razorpay'; orderId: string; amount: number; currency: string; keyId: string | null }`.
- `POST /payments/verify` 🧑 `{ appointmentId, orderId, paymentId, signature }` → `Appointment`. In `mock` mode the client sends `paymentId: 'mock_<anything>'` and `signature: 'mock'`. This is accepted only when `PAYMENTS_MODE=mock`, which the API refuses in production.
- `POST /payments/webhook` 🔓 (Razorpay, raw body, `X-Razorpay-Signature`) → `{ received: true }`.

### Notifications
- `GET /notifications` 🧑🩺 query: `unread` (`true`), `page`, `limit` → `Paginated<Notification> & { unreadCount: number }`.
- `PATCH /notifications/:id/read` 🧑🩺 → `Notification`.
- `PATCH /notifications/read-all` 🧑🩺 → `{ updated: number }`.

### Doctor self-service
- `GET /doctor/profile` 🩺 → `DoctorAdmin`.
- `PATCH /doctor/profile` 🩺 `{ about?, fees?, address?, available? }` → `DoctorAdmin`.
- `GET /doctor/schedule` 🩺 → `Schedule`.
- `PUT /doctor/schedule` 🩺 `Schedule` → `Schedule`. Validates `HH:mm`, `start < end`, breaks inside working hours, no overlapping breaks, and unique days. Existing appointments are kept.
- `GET /doctor/leaves` 🩺 → `Leave[]` (today onward, ascending).
- `POST /doctor/leaves` 🩺 `{ date, reason }` → `Leave`. Returns `409 CONFLICT` if a booked appointment exists that day, unless `{ cancelAppointments: true }` is sent, in which case those appointments are cancelled by the doctor with the leave reason.
- `DELETE /doctor/leaves/:id` 🩺 → `null`.
- `GET /doctor/dashboard` 🩺 → `{ earnings: { total: number; thisMonth: number }; patients: number; appointments: { today: number; upcoming: number; completed: number; cancelled: number; noShow: number }; rating: { average: number; count: number }; next: Appointment[]; earningsSeries: { period: string; amount: number }[] }`. `next` holds up to 5 items and `earningsSeries` covers the last 6 months as `YYYY-MM`. Earnings count only `paid` appointments.
- `GET /doctor/patients/:patientId/appointments` 🩺 → `Appointment[]`. This patient's appointments with this doctor only, newest first.

### Admin
- `GET /admin/doctors` 🛡 query: `search`, `speciality`, `active`, `page`, `limit` → `Paginated<DoctorAdmin>`.
- `POST /admin/doctors` 🛡 *multipart*: `name`, `email`, `password`, `speciality`, `degree`, `experienceYears`, `about`, `fees`, `address` (JSON), `schedule` (JSON, optional; defaults to Mon–Fri 10:00–17:00 with a 13:00–14:00 break), `image` (optional) → `DoctorAdmin` (201).
- `PATCH /admin/doctors/:id` 🛡 *multipart*, any subset of the create fields except `password` → `DoctorAdmin`.
- `PATCH /admin/doctors/:id/availability` 🛡 `{ available }` → `DoctorAdmin`.
- `PATCH /admin/doctors/:id/active` 🛡 `{ active }` → `DoctorAdmin`. Deactivating does not cancel existing appointments, but deactivated doctors are hidden from public listings.
- `PUT /admin/doctors/:id/schedule` 🛡 `Schedule` → `Schedule`.
- `GET /admin/patients` 🛡 query: `search`, `blocked`, `page`, `limit` → `Paginated<Patient & { appointmentsCount: number }>`.
- `PATCH /admin/patients/:id/block` 🛡 `{ blocked }` → `Patient`. Blocking also revokes the patient's refresh tokens.
- `GET /admin/appointments/export` 🛡 query: same filters as `GET /appointments` → `text/csv` (streamed) with columns `id,date,time,patient,patientEmail,doctor,speciality,status,paymentStatus,fee,currency,createdAt`.
- `GET /admin/reviews` 🛡 query: `doctorId`, `maxRating`, `page`, `limit` → `Paginated<Review>`.
- `DELETE /admin/reviews/:id` 🛡 → `null`.
- `GET /admin/specialities` 🛡 → `Speciality[]`.
- `POST /admin/specialities` 🛡 `{ name, description }` → `Speciality` (slug derived from the name).
- `PATCH /admin/specialities/:id` 🛡 `{ name?, description? }` → `Speciality`.
- `DELETE /admin/specialities/:id` 🛡 → `null`. Returns `409 CONFLICT` while doctors still use it.
- `GET /admin/settings` 🛡 → `Settings`. `PUT /admin/settings` 🛡 `Partial<Settings>` (excluding `timezone`) → `Settings`.
- `GET /admin/audit-logs` 🛡 query: `action`, `actorRole`, `from`, `to`, `page`, `limit` → `Paginated<{ id; actor: { role; id; name }; action: string; target: { type: string; id: string } | null; meta: object; ip: string; createdAt: string }>`.
- `GET /admin/analytics/summary` 🛡 → `{ doctors: number; activeDoctors: number; patients: number; appointments: { total; booked; completed; cancelled; noShow }; revenue: { total: number; last30Days: number }; cancellationRate: number; averageRating: number }`. `cancellationRate` is a fraction from 0 to 1, rounded to 3 decimals.
- `GET /admin/analytics/timeseries` 🛡 query: `from`, `to` (default the last 30 days), `interval` (`day` | `week` | `month`) → `{ period: string; appointments: number; completed: number; cancelled: number; revenue: number }[]`. Every period in the range is present, zero-filled. Periods are labelled `YYYY-MM-DD` for `day` and `week` (the week starts Monday) and `YYYY-MM` for `month`.
- `GET /admin/analytics/specialities` 🛡 → `{ speciality: string; specialityName: string; appointments: number; revenue: number }[]`.
- `GET /admin/analytics/top-doctors` 🛡 query: `limit` (default 5) → `{ doctor: { id; name; image; speciality }; appointments: number; revenue: number; rating: number }[]`.

Revenue is always the sum of `fee` over appointments whose `paymentStatus` is `paid`.

## Client token handling

- The patient app stores `AuthTokens` in `localStorage` under `bma.patient.auth`, and the staff app under `bma.staff.auth`.
- On `401 TOKEN_EXPIRED` the client calls `POST /auth/refresh` once (requests that arrive meanwhile wait for that single refresh) and then retries the original request. If the refresh fails, the client clears the session and redirects to the login page.
