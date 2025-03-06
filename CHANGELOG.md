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

### Known gaps
- The Docker images were never built: pulling base images was refused (HTTP 401 from the registry) in the
  environment where this was written. `docker compose config` validates the Compose file, and the API's runtime
  layout was checked by running it from a production-only install.
- Two moderate `react-router` advisories remain in both SPAs (fix needs React Router 7).
- Razorpay mode and Google sign-in were never exercised against the real services.
- Tokens are kept in `localStorage`, as the contract specifies.
