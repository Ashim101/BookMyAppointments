# BookMyAppointments Staff

Single-page staff console for administrators and doctors. It talks to the backend described in [`docs/API.md`](../docs/API.md).

## Stack

React 18, Vite 5, Tailwind CSS 3, Redux Toolkit (auth session), react-router 6, axios, react-toastify. Charts are small hand-written SVG components; there is no chart library.

## Getting started

```bash
cd admin
npm install
cp .env.example .env.local   # set VITE_API_URL, no trailing slash
npm run dev
```

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server on port 5174 |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint, fails on any warning |
| `npm test` | Vitest unit and component tests |
| `npm run test:coverage` | Tests with a v8 coverage report |

## Configuration

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL, for example `http://localhost:4000`. Requests go to `${VITE_API_URL}/api`. |

## Layout of `src/`

- `api/` axios client (envelope unwrapping, `ApiError`, single-flight token refresh) and one module per domain.
- `features/auth/` Redux slice that persists the session under `localStorage['bma.staff.auth']`.
- `hooks/` data fetching (`useFetch`), debouncing, polling and saved filters.
- `lib/` pure helpers: date, time, currency, age, schedule validation, calendar math, chart scales, error-code map.
- `components/ui/` design-system primitives, `components/charts/` SVG charts, `components/` shared composites.
- `layouts/` role-based shells, `routes/` guards and the router.
- `pages/` auth, `pages/admin/` and `pages/doctor/` screens.

## Roles

Both roles sign in at `/login`. Admins land on `/admin`, doctors on `/doctor`. Visiting the other role's area redirects to your own home. Doctors can also use `/forgot-password` and `/reset-password?token=…&role=doctor`.

## Keyboard shortcuts

On the doctor calendar: left and right arrows change week, `t` jumps to today.

## Deployment

`vercel.json` rewrites every path to `index.html` so client-side routes work on refresh.
