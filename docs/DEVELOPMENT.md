# Development guide

## Prerequisites

- Node 20 (`nvm use` reads `.nvmrc`) and npm.
- MongoDB 6 or newer for running the API: `docker run -d --name bma-mongo -p 27017:27017 mongo:7`.
- For the end-to-end suite: Docker (it starts `mongo:7` itself) and Google Chrome.

Each app is its own npm project with its own lock file. Install with `npm ci` inside each directory.

## Workflow

1. Change the contract first when behaviour crosses the API boundary: edit [`API.md`](API.md), then the backend
   and whichever app is affected. The contract is the arbiter: code that deviates from it is the bug, unless the
   contract itself is wrong, in which case fix the contract and say so in the commit.
2. Write or update tests next to the change (see Testing strategy).
3. Run lint and the suite of every app you touched; run the e2e suite when a flow changes.
4. Commit in small steps with conventional messages (`feat:`, `fix:`, `test:`, `docs:`, `build:`, `ci:`, `chore:`).
   Never commit `.env` files; only `.env.example` files are tracked.

## Scripts

| Where | Script | Purpose |
|---|---|---|
| `Backend` | `npm run dev` / `npm start` | run the API (nodemon or plain node) |
| | `npm test`, `npm run test:coverage` | Vitest and supertest, optional v8 coverage |
| | `npm run lint`, `npm run format` | ESLint with zero warnings, Prettier |
| | `npm run seed [-- --reset]` | demo data (`--reset` wipes application data first) |
| | `npm run hash-password -- <pw>` | bcrypt hash for `ADMIN_PASSWORD_HASH` |
| `Book-My-Appointment`, `admin` | `npm run dev` | Vite dev server (5173 and 5174) |
| | `npm test`, `npm run test:coverage` | Vitest with Testing Library |
| | `npm run lint`, `npm run build`, `npm run preview` | ESLint, production build, serve the build |
| `e2e` | `npm run setup` | `npm ci` in the other three apps |
| | `npm test`, `npm run test:headed` | whole stack plus the Playwright suite |
| | `npm run report` | open the last HTML report |

## Conventions

- **Backend:** ES modules, one folder per domain under `src/modules`. Controllers stay thin, services hold rules,
  routes only wire middleware. Throw `AppError` with a contract error code; never build error responses by hand.
  Mutations that must not race are single conditional updates (`findOneAndUpdate` with the expected state in the
  filter) or rely on a unique index. Anything time-dependent takes the injected `clock`, never `Date.now()`.
- **Frontends:** call the API only through `src/api`, show errors through the error-code table, and trust the
  `actions` flags instead of recomputing permissions. Dates and times are rendered in the clinic timezone the API
  returns.
- **Secrets:** nothing secret goes into a frontend (`VITE_*` values are public). Never print or commit real
  credentials; use throwaway values for local runs.
- Formatting follows `.editorconfig`; the backend is formatted with Prettier.

## Testing strategy

| Layer | What it proves | Where |
|---|---|---|
| Unit | pure logic: slot engine, time zones and DST, state machine, signatures, config validation, CSV | `Backend/tests/unit`, `*.test.js` beside frontend code |
| API integration | every endpoint, role and error code against a real MongoDB with a fake clock; concurrency (double booking), idempotency, refunds, the reminder job, a real server process (start-up, shutdown, production guards) | `Backend/tests/integration` |
| Component | screens and dialogs against a mocked HTTP adapter | `src/**/*.test.jsx`, `admin/tests` |
| End to end | the real UI in Chrome against the real API and database, including token refresh | `e2e/tests` |

The mocked-HTTP component tests cannot catch a frontend that disagrees with the backend, which is what the e2e
suite is for. When an integration bug is found, fix the deviating side and add a regression test to that app's own
unit suite as well as, where useful, an e2e scenario.

### Backend tests

They need a real MongoDB. By default `mongodb-memory-server` downloads one; to use your own set
`MONGODB_URI_TEST=mongodb://127.0.0.1:27018` (for example `docker run -d --rm -p 27018:27017 mongo:7`). Every test
file creates and drops its own database, so runs never interfere.

### End-to-end suite

`cd e2e && npm test` lets Playwright start three servers, each in its own process:

1. `scripts/start-backend.mjs` starts a `mongo:7` container on port 27019 (or uses `E2E_MONGODB_URI`), seeds it,
   and runs the API on 4100 with throwaway secrets, 5-second access tokens (so every long scenario exercises silent
   refresh) and debug logging. It runs from `e2e/.run`, so no `.env` of yours is ever read. On SIGTERM it stops the
   API and removes the container.
2. The patient app on 5273 and the staff console on 5274 (Vite dev servers pointed at that API).

The tests run in numbered order on one worker because they build on each other's data (a patient registers, books,
is seen by a doctor, reviews, is blocked by an admin, and so on). The browser is the system Google Chrome
(`channel: 'chrome'`). Useful variants:

```bash
npx playwright test 05 --headed      # one file, visible browser (it needs the earlier files' data, so run 01 to 05)
E2E_MONGODB_URI=mongodb://127.0.0.1:27017/bma_e2e npm test   # use an existing MongoDB instead of Docker
```

Two choices worth knowing:

- **OTPs and reset links come from the API's mail log.** Without SMTP the API logs each message at debug level
  (outside production). The tests read `e2e/.run/backend.log`. This avoids any test-only code path in the server
  (a mail sink enabled by `NODE_ENV=test` would be one more thing that must never ship) and exercises the exact
  mailer used in development.
- **The completion step moves one appointment into the past through the database.** A doctor may complete a visit
  from 15 minutes before it starts, but the API refuses to book anything starting within 30 minutes and the real
  clock cannot be advanced. `helpers/db.js` therefore rewrites that one appointment's date, time and unique slot keys
  to 45 minutes ago, which is the state the system is in once the visit time arrives. Everything else goes through
  the UI and the API.

### CI

`.github/workflows/ci.yml` runs the same commands as above: one job per app (install, lint, coverage, build,
production audit; coverage uploaded as an artifact), a job that validates both Compose files, then the e2e job against a `mongo:7` service container, with
the Playwright report uploaded.

## Docker

```bash
cp .env.example .env     # fill in the secrets, the encryption key and the Razorpay values
docker compose config    # validates the file and the required variables
docker compose up --build

# local trial with mock payments (never for real data):
docker compose -f docker-compose.demo.yml up --build
```

See the root README for the full quick start.
