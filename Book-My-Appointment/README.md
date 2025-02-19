# BookMyAppointments patient app

The patient-facing web app for BookMyAppointments: find a doctor, pick a real open slot, book, pay, reschedule or cancel, and read your consultation notes and prescription afterwards.

Built with React 18, Vite 5, Tailwind CSS 3, Redux Toolkit, React Router 6 and axios. It talks to the REST API described in [`../docs/API.md`](../docs/API.md), which is the contract between this app, the backend and the staff app.

## Getting started

```bash
cp .env.example .env.local   # then edit the values
npm install
npm run dev
```

The dev server starts on <http://localhost:5173>. The backend is expected at `VITE_API_URL` (default `http://localhost:4000`).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | yes | Base URL of the backend, without a trailing slash. The app calls `${VITE_API_URL}/api`. |
| `VITE_GOOGLE_CLIENT_ID` | no | Public Google OAuth client id. When empty, the Google sign-in button is hidden. |
| `VITE_CANCELLATION_CUTOFF_HOURS` | no | Cutoff shown in the cancellation dialog (default `24`). Keep it equal to the backend setting `cancellationCutoffHours`; the server remains the authority. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint (the project is kept at zero warnings) |
| `npm test` | Run the Vitest suite once |
| `npm run test:coverage` | Run the suite with a V8 coverage report |

## Project layout

```
src/
  api/          axios client (envelope unwrapping, ApiError, single-flight token refresh) and one module per domain
  features/     Redux slices (auth, notifications) and feature hooks (payments, notification polling)
  store/        store factory, token persistence and client wiring
  hooks/        useQuery / useAction data hooks and small UI hooks
  lib/          formatting in the clinic timezone, error-code messages, validation, .ics export
  components/   ui primitives, layout, illustrations and feature components
  pages/        route components
  routes/       route table, ProtectedRoute and scroll restoration
  test/         test helpers (mocked HTTP adapter, factories, render helper)
```

### How it works

- **Auth**: `AuthTokens` are persisted in `localStorage['bma.patient.auth']`. On `401 TOKEN_EXPIRED` the client refreshes once (concurrent requests wait for the same refresh) and retries; if the refresh fails the session is cleared and the user is sent to `/login`.
- **Slots** always come from `GET /doctors/:id/slots`; nothing is generated in the browser. All dates and times are shown in the clinic timezone reported by the API.
- **Appointment actions** (pay, cancel, reschedule, review) are driven only by the `actions` flags the API returns.
- **Payments** support the `mock` mode (a clear test-payment confirmation) and `razorpay` (checkout script is loaded on demand).
- **Printing**: the appointment detail page has a print stylesheet for the prescription.

## Deployment

`vercel.json` rewrites every path to `index.html` so client-side routes work on refresh.
