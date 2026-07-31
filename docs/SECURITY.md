# CMIS Security Notes

## RFID device key rotation

Each reader authenticates with a per-device API key (`x-device-id` +
`x-device-key` headers), stored server-side only as a SHA-256 hash
(`devices/{deviceId}.apiKeyHash`) — the raw key is shown exactly once, at
provisioning time, and is never persisted or returned by any endpoint after
that.

**To rotate a device's key** (compromised reader, lost hardware, routine
rotation):

1. Admin dashboard → **RFID → Devices** → **Revoke** on the affected device.
   This deletes its `devices/{deviceId}` doc immediately — any tap using the
   old key starts failing with `401 UNKNOWN_DEVICE` right away.
2. Click **Provision Device**, select the same bus. A new `deviceId` +
   `rawKey` pair is generated.
3. Update the reader's firmware config with the new `deviceId`/`rawKey` and
   redeploy it to the bus.

There is no in-place "rotate" endpoint by design — revoke-then-reprovision
is simpler to reason about (no window where two keys are simultaneously
valid) and matches how the admin UI already models device lifecycle.

## Findings from the Phase 12 audit (2026-07)

Fixed:
- **IDOR in `GET /drivers/:id/public`** — any authenticated account could
  fetch any driver's phone number by guessing/enumerating a `driverId`
  (reachable via any bus's `driverId` field, itself intentionally public so
  students can track any campus bus). Now checks the actual relationship:
  the caller must be that driver, an admin, or a student whose assigned
  bus's driver matches.
- **`apiKeyHash` exposure** — `GET /devices` and the provision response
  both returned the full `Device` document, including the device's hashed
  API key, to the admin frontend, which never reads that field. Stripped at
  the service layer (`PublicDevice = Omit<Device, 'apiKeyHash'>`). Low
  severity on its own (one-way hash of a 192-bit random key), but no reason
  to hand out credential material the client doesn't need.
- **No rate limit on `POST /rfid/tap`** — added a limiter keyed by
  `deviceId` (not IP — many readers share a campus network's egress IP),
  15 requests / 10s. Verified live: 20 concurrent taps → exactly 15 through,
  5 × `429`.
- **`firestore.rules` gaps** — `tapRejections`, `settings`, and the
  `gps/{busId}/history` subcollection (all added in later phases) were
  missing from the rules file written in Phase 3. Added, same deny-by-default
  policy as every other collection.

Reviewed, no changes needed:
- Every route file audited for `verifyToken`/`requireRole` coverage — no
  gaps found beyond the two above.
- Every `POST`/`PATCH` route audited for `validateBody` — the handful
  missing it (`/trips/:id/end`, pass `revoke`, notification `read`) take no
  body to validate.
- Every controller reading `req.parsedQuery` confirmed to have a matching
  `validateQuery` on its route.
- `errorHandler` never leaks stack traces to the client (logs server-side
  only; unknown errors return a bare `Internal server error`).
- CORS is an explicit origin allowlist (`CORS_ORIGIN` env var), not a
  wildcard; `helmet()` applied; JSON body capped at 1MB; Excel upload capped
  at 5MB.
- `.env`, `serviceAccountKey.json` confirmed git-ignored and never
  appeared in `git status` across the whole build.

Fixed since (2026-07):
- **`brace-expansion` (high, DoS via unbounded glob expansion)** — reached
  both apps transitively through `firebase-admin` → `@google-cloud/firestore`
  → `google-gax` → `rimraf` → `glob` → `minimatch`. Not reachable from any
  actual request path in this app (it's glob-matching used by Firestore
  client's own internal tooling, never fed user input), but a real, safe
  fix existed: pinned via `"overrides": { "brace-expansion": "^5.0.8" }` in
  both `package.json`s. Verified the full backend integration suite (12
  tests) still passes against the patched version before keeping it —
  12 → 7 vulnerabilities on the backend as a result.

Known, disclosed, not fixed here:
- **`npm audit`**: `xlsx` (high — prototype pollution + ReDoS, no fix
  published on the npm registry) is a direct dependency in both apps.
  Backend's exposure is the Excel *import* path (`POST /students/import`,
  admin-only, 5MB cap) — parsing untrusted input is where these CVEs bite;
  the frontend's usage is export-only (writing from known-good data), which
  isn't the vulnerable code path. SheetJS publishes patched builds outside
  the npm registry; switching the install source is a deliberate call for
  the project owner, not something to change silently — flagging it here
  rather than making that swap unprompted.
  A moderate `uuid` advisory reaches this project transitively through
  `firebase-admin`'s Cloud Storage dependency chain (which this project
  never calls — only Firestore/Auth are used). `npm audit fix --force`
  would downgrade `firebase-admin` to v10, a breaking regression — not
  applied.
- **`react-router` (high, "RSC Mode CSRF Bypass Allows Action Execution
  Before 400 Response")** — flagged on the frontend at the latest
  published version (7.18.1); there is currently no patched release in
  the 7.x/8.x line at all, so the only thing `npm audit fix --force`
  offers is downgrading seven minor versions to 7.11.0, a real regression
  for zero actual risk reduction. The vulnerable code path is React
  Router's **RSC (React Server Components) mode** — server actions with
  CSRF checks bypassable before a 400 response. This app is a pure
  client-side SPA (`BrowserRouter`, no RSC, no server actions anywhere in
  this codebase) — the vulnerable feature is simply never invoked. Will
  revisit once a patched 7.x release exists; downgrading now buys nothing.
- Frontend's own `npm audit` additionally shows the same `brace-expansion`/
  `uuid` chain a second time, via `firebase-admin` — but only as a
  **devDependency** (added purely for `e2e/firestore-cleanup.ts`'s test
  teardown), never bundled into the production build. Same fix applied
  (the `overrides` entry) for defense in depth in local dev anyway.
- **Firestore rules deployment**: `firestore.rules` is correct and
  version-controlled, but still not deployed to the live project — the
  service account lacks the IAM permission the CLI needs (see the Phase 3
  notes). Deploy via `firebase login` (your own account) + `firebase deploy
  --only firestore:rules`, or paste the file into Console → Firestore →
  Rules.
