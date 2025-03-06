# Changelog

## Unreleased: production overhaul

The three applications were rebuilt in parallel against one written contract ([`docs/API.md`](docs/API.md)) and then
integrated. Treat this as a new system that lives in the same repository, not as an incremental upgrade.

### What exists now
- **Backend:** Express 5 and Mongoose 9, organised by domain. Slot generation with timezone and DST handling,
  an appointment state machine, double-booking prevention with unique partial indexes, mock and Razorpay payments,
  rotating refresh tokens, hashed OTPs, audit log, analytics aggregations, a reminder and refund job, and a seed script.
- **Patient app and staff console:** rewritten as separate single-page apps that call only the documented API.
- **Delivery:** Dockerfiles, a Compose stack, a GitHub Actions workflow and a Playwright end-to-end suite that
  drives both apps against the real API and MongoDB in Chrome.

### Added during integration
- `GET /api/settings/public`. The patient app now takes the cancellation cutoff and the booking window from it
  instead of an environment variable (`VITE_CANCELLATION_CUTOFF_HOURS` is gone).
- Production start-up checks (secrets, admin hash, explicit CORS origins), an API-wide rate limit, and mail bodies
  never being logged in production.
- Dependency updates for the two SPAs to clear high and critical advisories in `axios`, `form-data` and the router.

### Fixed during integration
- The API's `uploads/` storage module had never been committed: a `uploads/` entry in `Backend/.gitignore` also
  matched `src/modules/uploads/`, so a fresh checkout could not start and most backend tests failed. The module is
  tracked now and the ignore rule is anchored to the repository's upload directory.
- The staff console's dev server now listens on 5174, matching the API's default CORS origins.

### Security fixes
- **Mock payments in production.** `PAYMENTS_MODE=mock` was the default, so a production-style configuration accepted
  any `mock_*` payment id as paid. With `NODE_ENV=production` the API now refuses to start unless
  `PAYMENTS_MODE=razorpay` and `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are set, and the
  mock provider throws in production even if constructed directly. There is no override. `docker-compose.yml` now
  requires the Razorpay values, and `docker-compose.demo.yml` is the separate local-evaluation stack with mock payments.
- **Health data at rest.** The appointment reason, consultation notes and prescription are now encrypted with
  AES-256-GCM (random IV per value, authenticated, key ring with rotation). New required variables:
  `DATA_ENCRYPTION_KEYS` and `DATA_ENCRYPTION_ACTIVE_KEY_ID`; new scripts `npm run generate-key` and
  `npm run encrypt-existing`. API responses are unchanged. **Upgrading an existing database:** back it up, set the
  keys and run `npm run encrypt-existing` before starting the new version; plaintext is refused, not served.
- The audit log recorded consultation notes and prescriptions in plaintext from the complete-visit request body.
  Those fields are now dropped from audit entries (entries already written keep them; delete or expire them).

### Known gaps
- The Docker images were never built: pulling base images was refused (HTTP 401 from the registry) in the
  environment where this was written. `docker compose config` validates the Compose file, and the API's runtime
  layout was checked by running it from a production-only install.
- Two moderate `react-router` advisories remain in both SPAs (fix needs React Router 7).
- Razorpay mode and Google sign-in were never exercised against the real services.
- Tokens are kept in `localStorage`, as the contract specifies.
