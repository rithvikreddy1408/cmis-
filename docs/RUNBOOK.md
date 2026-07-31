# CMIS Runbook

Deployment, testing, onboarding, and incident-response reference for
operating CMIS beyond local dev. See [`docs/SECURITY.md`](./SECURITY.md) for
the security audit and device key rotation procedure.

## Continuous integration

`.github/workflows/ci.yml` runs on every push/PR to `main`:

- **backend** job — typecheck, build, integration tests. Self-contained
  (Firebase emulators), no secrets needed, always runs.
- **frontend** job — lint, typecheck, build. Also self-contained, always
  runs.
- **e2e** job — the real happy-path suite against a real Firebase
  project. Skips itself cleanly (with a warning, not a failure) until you
  add three repo secrets (Settings → Secrets and variables → Actions):
  - `FIREBASE_SERVICE_ACCOUNT_JSON` — the backend's service account key,
    full JSON pasted as one secret
  - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` — a seeded super admin (see
    `npm run seed:admin` in `backend/`)

## Running the test suites

**Backend integration tests** (auth, RFID tap pipeline, trip lifecycle)
run against the Firebase emulator suite, not real Firestore — no
cleanup needed, no live data touched:

```
cd backend
npm run test:integration
```

This spins up the Auth + Firestore emulators (`firebase emulators:exec`),
runs `vitest`, and tears the emulators down automatically. Requires Java
(the emulators run on the JVM) and `firebase-tools` (available via `npx`,
no global install needed).

**Frontend E2E** (`login → start trip → tap → track → report`) runs
against the real dev servers and a real Firestore project — it creates
its own bus/driver/student/device, fully cleans them up in a `finally`
block, and simulates the RFID tap the same way real reader hardware
would (a plain HTTP call with device-key headers, no hardware needed).
Trips and attendance have no admin-facing delete endpoint (by design —
they're permanent audit records in production), so the test's teardown
reaches into Firestore directly via `e2e/firestore-cleanup.ts` to purge
exactly the trip/attendance/rfid-card docs it created; it looks for
`backend/serviceAccountKey.json` by relative path, or
`GOOGLE_APPLICATION_CREDENTIALS_JSON`, same as the backend:

```
cd frontend
E2E_ADMIN_EMAIL=<seeded admin email> E2E_ADMIN_PASSWORD=<its password> npm run test:e2e
```

Requires both dev servers already running (`npm run dev` in `backend/`
and `frontend/`) and a seeded super admin (`backend/npm run seed:admin`).

**Visual regression** (`e2e/visual.spec.ts`) screenshots the login and
forgot-password pages — the only two pages with zero live-data
dependency, so a diff always means an actual UI regression, never "someone
added a student." This is exactly the kind of check that would have
caught two real bugs found by hand this session: the app font silently
failing to load, and the background briefly rendering white. Run it the
same way (`npm run test:e2e` runs it alongside the happy path, or `npx
playwright test visual.spec.ts` alone).

Baselines are platform-specific (font rasterization differs by OS) — the
committed ones were generated on macOS. **Not wired into the GitHub
Actions CI** for that reason: a Linux runner would need its own baseline
committed first (`npx playwright test visual.spec.ts --update-snapshots`
run once *on* a Linux CI job, with the resulting PNGs committed back).
Until then, treat it as a local pre-push habit.

**Accessibility** (`e2e/accessibility.spec.ts`) runs a real axe-core scan
— a meaningfully different, broader rule set than Lighthouse's
accessibility category — across every route in all three portals, not a
sample. It's caught real issues Lighthouse's own scoring missed entirely
(an empty table header, an unlabeled `<select>`, two unnamed icon
buttons, a page missing its `<h1>`) — "Lighthouse says 100" and "a real
accessibility engine found nothing" are different claims, and this
project has had them disagree. Runs the same way (`npm run test:e2e`, or
`npx playwright test accessibility.spec.ts` alone); self-contained, same
create-scan-cleanup pattern as the other suites.

## Performance

**Load test** (`backend/npm run loadtest`) creates a fleet-sized set of
real fixtures (default 20 buses/drivers/students/devices, each with an
active trip) against the real project, fires one RFID tap per bus
concurrently (the "everyone's morning rush" case), separately hits the
admin dashboard with 50 concurrent connections for 10s (the "everyone
checks during a fire drill" case), and cleans up everything it created —
including the GPS-watchdog notifications and `gps/{busId}` docs that
firing 20 fake "on_trip" buses without real GPS pings triggers, the same
cleanup gap found and fixed in the E2E suite's own teardown.

```
LOADTEST_ADMIN_EMAIL=<seeded admin> LOADTEST_ADMIN_PASSWORD=<its password> \
LOADTEST_FIREBASE_API_KEY=<frontend's VITE_FIREBASE_API_KEY value> \
npm run loadtest
```

(The dashboard scenario needs a real ID token, gotten via plain password
sign-in against the Auth REST API — deliberately not `createCustomToken`,
which needs the IAM Service Account Credentials API enabled on the GCP
project; that's disabled here, same gap as the Firestore rules
deployment in SECURITY.md. Omit the three env vars and that scenario
skips itself cleanly.)

Real results measured against the live project (2026-07-26), fleet size
20, three separate runs:

| Scenario | Result |
|---|---|
| Single sequential tap (the actual real-world pattern — one reader, one student at a time) | **~1.3–1.6s**, consistent across 5 taps |
| 20 buses tapping in the same instant (worst-case stress, not realistic for one campus) | p50 1.5–3.5s, p95 up to 5.1s, run-to-run variance was large — **0 failures** in every run |
| Dashboard, 50 concurrent connections, 10s | p50 ~505ms, p95 ~1.7–1.8s, **0 errors**, ~85 req/s — consistent across every run |

Honest read: the dashboard numbers are clean and trustworthy. The 20-way
concurrent tap numbers swung wide enough between runs (network/connection
overhead against a real internet-bound Firestore project, not this app's
own logic) that they're a weaker signal — concurrent taps at that scale
aren't the realistic case anyway (one bus's reader processes one tap at a
time as students board over a minute or two, not 20 buses in the same
millisecond). The single-tap number is the one that actually reflects
what a student sees. `recordTap` (`backend/src/services/attendance.service.ts`)
was refactored during this to fire its independent Firestore reads
(card/trip/bus/gps lookups) in parallel instead of sequentially — correct
and verified via the full integration suite either way, but the benchmark
itself couldn't cleanly isolate its effect from real network variance at
20-way concurrency. Worth re-measuring with a controlled/local setup if
tap latency ever becomes a real complaint during the pilot.

**Real-user Core Web Vitals** flow through the same Sentry pipeline as
error tracking (see below) — `browserTracingIntegration()` in
`frontend/src/main.tsx` attaches LCP/CLS/INP/FCP/TTFB to every real
pageload once `VITE_SENTRY_DSN` is set. No separate account or setup
needed beyond the DSN you already need for error tracking.

## Data safety — backup & restore

No automated backup existed before this. `backend/npm run backup` dumps
every collection (plus the `gps/{busId}/history` subcollection) to
timestamped JSON under `backend/backups/<timestamp>/` — gitignored, since
it's real student/driver PII and never belongs in the repo. Read-only
against Firestore, safe to run anytime, including against the live
project.

```
npm run backup                    # writes to ./backups/<timestamp>
npm run backup -- --out /somewhere/else
```

`backend/npm run restore` reads one back. **Defaults to a dry run** —
prints exactly what it would write, per collection, without touching
Firestore, verified empirically (ran it, confirmed nothing changed,
then ran the real thing) rather than just trusted:

```
npm run restore -- --dir ./backups/2026-07-26T...              # dry run
npm run restore -- --dir ./backups/2026-07-26T... --collection students --confirm
```

`--collection` restores just one (the realistic case: an admin
accidentally bulk-deleted students, not the whole database). Round-trip
fidelity verified directly: backed up a real document, deleted it,
restored it, confirmed the restored data was byte-identical to the
original.

**This is a local snapshot mechanism, not a disaster-recovery plan** — a
backup sitting next to the code on the same machine doesn't survive that
machine failing. For real safety, run `npm run backup` on a schedule
(cron, or a scheduled GitHub Actions job) pointed at `--out` on
off-machine storage — a private cloud storage bucket, not this repo.
Setting up that schedule and choosing where backups actually live is
yours to decide; the export/restore mechanism itself is done and
verified.

### Student deletion cascade (fixed 2026-07)

`deleteStudent` used to only delete the student doc and their linked
Firebase Auth user — any bus pass or RFID card stayed behind, `active`,
pointing at a `studentId` that no longer existed. Found via a routine
`npm run backup`: two `busPasses` docs referencing students that weren't
there anymore. Real gap, not a test artifact — every student deletion in
normal operation (a graduating class, a withdrawal) left this garbage
behind permanently, with no cleanup path.

Fixed by calling the existing `revokePass`/`reportLostOrDeactivate`
before the student doc is deleted (both update the student record as
part of their own logic, so order matters). Passes end up `revoked`,
cards `deactivated` — same permanent-audit-trail convention already used
for trips and attendance, not a hard delete. Covered by
`tests/integration/students.test.ts`.

## Deploying

### Frontend → Firebase Hosting

```
cd frontend && npm run build
firebase deploy --only hosting
```

`firebase.json` already has the `hosting` block (`public: frontend/dist`,
SPA rewrite to `index.html`). This requires `firebase login` with an
account that has deploy access to the `cmis-62871` project — the service
account currently configured for this repo does not have that IAM
permission (same gap blocking `firestore:rules` deploys, see
SECURITY.md).

### Backend → Render or Cloud Run

A `Dockerfile` (multi-stage: `npm ci` + `tsc` build, then a slim
production-deps-only runtime image) lives in `backend/`. Either host
builds directly from it.

**Render**: `render.yaml` at the repo root is a Blueprint — push it and
Render provisions the service from `backend/Dockerfile`. Set these env
vars in the Render dashboard after the first deploy (`sync: false` in the
blueprint means "prompt for it, don't commit a value"):
- `CORS_ORIGIN` — the deployed frontend's origin
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` — paste the full service-account
  JSON as one line (Render has no mountable file path for it; see the
  `GOOGLE_APPLICATION_CREDENTIALS_JSON` support added to
  `backend/src/firebase/admin.ts`)
- `GOOGLE_MAPS_SERVER_KEY` — once a Maps key is provisioned

Use at least the **Starter** plan, not Free — free instances sleep after
inactivity, which drops every open Socket.IO connection (live bus
tracking) on every cold start. This is the "min 1 instance" requirement
from the build plan.

**Cloud Run**: `gcloud run deploy cmis-backend --source backend --min-instances=1`.
On Cloud Run you can skip `GOOGLE_APPLICATION_CREDENTIALS_JSON` entirely
and attach a service account with Firestore/Auth Admin roles directly to
the Cloud Run service — Application Default Credentials picks it up from
the metadata server with no key material in an env var at all. Set
`--min-instances=1` for the same Socket.IO reason as above.

### Firestore rules & indexes

Still not deployed live (see SECURITY.md — IAM gap on the current service
account). Once you have an account with deploy access:

```
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

### Web Push (FCM) — optional, needs one more key

Everything is built and wired — the "Enable push notifications on this
device" button on every portal's Notifications page, the backend send
path (`backend/src/services/push.service.ts`), token storage on the
user's own doc, and a merged service worker (`frontend/src/sw.ts`) that
receives push while the tab is closed. What's missing is a **VAPID key
pair**, which only you can generate (same category as the Google Maps
key — tied to your specific Firebase project):

1. Firebase console → your project → ⚙️ Project settings → **Cloud
   Messaging** tab → **Web configuration** → generate a key pair.
2. Copy it into `frontend/.env` as `VITE_FIREBASE_VAPID_KEY`.
3. That's it — no backend key needed; `firebase-admin`'s existing service
   account credentials already cover sending, it's the browser-side
   `getToken()` call that needs the VAPID key to authenticate.

Without it, the app works exactly as it does today — the enable button
requests browser notification permission fine, but silently can't fetch
an FCM token, so no push actually sends. Nothing breaks either way.

### Error tracking (Sentry) — optional, needs one key per app

Wired into both apps (`backend/src/instrument.ts`, initialized first thing
in `server.ts`; `frontend/src/main.tsx`, plus every error the app's
`ErrorBoundary` catches gets reported too) — gated entirely behind an env
var, same pattern as everything else above:

1. sentry.io → New Project → pick **Node.js** for one project, **React**
   for another (or one project, two DSNs — your call).
2. `backend/.env`: `SENTRY_DSN=...`
3. `frontend/.env`: `VITE_SENTRY_DSN=...`

Leave either blank and that app just logs to the console like it always
has — nothing breaks, you just don't get anything in Sentry.

### Uptime monitoring — this one's on you, nothing to wire

Not something I can set up for you — it's a third-party dashboard, not
code. Pick one (UptimeRobot and Better Uptime both have a real free
tier), sign up, and give it `https://<your-backend-host>/api/v1/health`
to ping every few minutes. That's the whole setup; the health endpoint
already exists and already reports whether Firebase is configured.

## RFID reader onboarding (per bus)

1. Admin dashboard → **Buses** → confirm the bus exists and has a driver
   assigned.
2. Admin dashboard → **RFID → Devices** → **Provision Device** → select
   the bus. Copy the shown `deviceId` and key immediately — the key is
   never shown again.
3. Flash the reader firmware with the API base URL, `deviceId`, and key.
   It authenticates every tap with `X-Device-Id` / `X-Device-Key` headers
   against `POST /api/v1/rfid/tap` — see `hardware/simulate-tap.mjs` for
   the exact request shape (useful for bench-testing a reader's firmware
   against a real backend before mounting it on the bus).
4. Tap a known, active-pass student's card and confirm it shows up in
   Admin → RFID → Devices ("Last Seen" updates) and in that student's own
   attendance history.

To retire or rotate a reader, see SECURITY.md's revoke-then-reprovision
procedure — there is no in-place key rotation by design.

## One-bus pilot week

- Provision exactly one reader (above) and confirm one full round trip:
  driver starts trip → students tap on boarding → admin dashboard shows
  live position + occupancy → driver ends trip → attendance appears in
  Reports.
- Watch for during the week:
  - **GPS gaps** — the driver app's geolocation publisher shows a banner
    when the tab is backgrounded (browsers throttle location updates);
    confirm drivers keep the tab foregrounded while driving.
  - **Tap failures** — Admin → RFID → Rejections Log shows every rejected
    tap with a reason (`UNKNOWN_CARD`, `PASS_INVALID`, `WRONG_BUS`,
    `NO_ACTIVE_TRIP`, card `lost`/`deactivated`). A cluster of one reason
    usually points at a data problem (pass not renewed, card not
    reassigned after a replacement) rather than a reader fault.
  - **Rate-limit false positives** — the tap endpoint allows 15
    taps/10s per device; a legitimate morning rush on a full bus is well
    under that, but if reports of dropped taps come in, check for `429`s
    in backend logs first.
- End of week: review the attendance % in Reports against the bus's
  actual ridership to sanity-check the pipeline before expanding to more
  buses.

## Incident basics

- **Backend down**: check the host's dashboard (Render service logs /
  `gcloud run services logs read cmis-backend`) for the crash reason
  first — most likely an unhandled exception in a route (should have
  been caught by `errorHandler`, so a raw crash usually means it happened
  outside Express, e.g. at startup with a missing env var).
- **A reader's key is compromised or the device is lost**: revoke it
  immediately (SECURITY.md procedure) — this takes effect on the next
  tap attempt, no propagation delay.
- **Bad deploy**: both Render and Cloud Run keep prior revisions/deploys
  and support one-click rollback from their dashboards — prefer that over
  a hotfix-forward when the previous version was known-good.
- **Firestore data issue**: `backend/src/scripts/` has `seedDemoData.ts` /
  `cleanupDemoData.ts` as a reference for scripted Firestore
  read/write/cleanup against the real project — copy the pattern for a
  one-off fix rather than editing documents by hand in the Console.
