# CMIS — Phased Build Plan

15 phases, ~14 weeks for a small team (2–3 devs) or ~20 weeks solo.
Each phase ends with a **working, demoable increment** and an exit checklist.
Architecture details live in [ARCHITECTURE.md](./ARCHITECTURE.md).

**Build order rationale:** foundation → identity → data → the two "engines"
(GPS tracking, RFID attendance) → real-time layer → the portals that consume
them → reporting/analytics → polish/security/launch. Portals come *after* the
engines so UI is built against real events, not mocks.

---

## Phase 1 — Project Setup & Skeleton (Week 1)

**Goal:** monorepo running end-to-end: React page calls Express, Express reads Firestore.

Tasks
- [ ] Scaffold `frontend/` (Vite + React 19 + TS), install Tailwind, React Router, TanStack Query, Framer Motion, Lucide
- [ ] Scaffold `backend/` (Express + TS, nodemon/tsx), health route `GET /api/v1/health`
- [ ] Create Firebase project(s) `cmis-dev` (+ `cmis-prod` later); enable Auth (email/password) + Firestore
- [ ] Backend: init Firebase Admin SDK from service-account env var; frontend: init Firebase client SDK
- [ ] Shared `types/` conventions; ESLint + Prettier; `.env.example` for both apps
- [ ] Git repo, branch protection, GitHub Actions (lint + typecheck + build)
- [ ] Folder structure exactly as in ARCHITECTURE.md §2

**Exit:** `npm run dev` in both apps; frontend fetches `/health`; a test doc written & read from Firestore.

---

## Phase 2 — Authentication & Role-Based Access (Week 1–2)

**Goal:** four roles logging into three different shells.

Tasks
- [ ] Backend: `verifyToken` middleware (Firebase ID token), `requireRole()` guard
- [ ] Custom claims: `role` set via Admin SDK; seed script creates one super admin
- [ ] `POST /auth/register` (admin-only user creation), `GET /auth/me`
- [ ] Frontend: `AuthContext` (login, logout, token refresh, persistence = "remember me"), Login + Forgot Password pages
- [ ] `ProtectedRoute` + `RoleRoute`; role-based redirect after login → `/admin`, `/student`, `/driver`
- [ ] Three empty layout shells (sidebar/topbar) per role

**Exit:** student can't open `/admin` (UI *and* API both reject); refresh keeps session; forgot-password email works.

---

## Phase 3 — Database Design & Core CRUD (Week 2–3)

**Goal:** all collections live; admin can manage students, drivers, buses, routes.

Tasks
- [ ] Define all collections/types from ARCHITECTURE.md §3; collection-name constants; zod schemas
- [ ] Firestore Security Rules v1 (deny-by-default, scoped reads) + `firestore.indexes.json`
- [ ] Services + REST CRUD: students, drivers, buses, routes (validation, pagination, search/filter)
- [ ] Uniqueness enforcement: rollNumber, rfidUID, busNumber
- [ ] Assignment logic: student↔bus↔route, driver↔bus (keep both sides consistent)
- [ ] Excel import (Multer + XLSX): validate rows, bulk-create students **and** their Auth accounts, return rejects report; Excel export
- [ ] Admin UI: data tables (search/filter/pagination), add/edit modals with React Hook Form, import/export buttons
- [ ] Seed script: 2 routes, 3 buses, 3 drivers, 50 students

**Exit:** import a 50-row Excel → students appear with working logins; broken rows reported, not silently dropped.

---

## Phase 4 — Route Management + Google Maps Foundation (Week 3–4)

**Goal:** routes drawn on real maps; Maps plumbing ready for tracking.

Tasks
- [ ] Google Cloud: enable Maps JS, Directions, Geocoding, Distance Matrix; two keys (browser referrer-restricted, server IP-restricted)
- [ ] Backend maps proxy: `/maps/directions`, `/maps/geocode`, `/maps/eta` (with 30 s caching)
- [ ] Route builder UI: click-to-add stops on map, drag to reorder, geocode search
- [ ] `POST /routes/preview` → Directions polyline, distance, expected time; persist polyline on save
- [ ] Reusable map components: `MapContainer`, `RoutePolyline`, `StopMarker`, `BusMarker`

**Exit:** admin creates a route on the map; saved route re-renders with polyline, stops, distance, ETA.

---

## Phase 5 — Trips + Live GPS Tracking (Week 4–5) ⚙️ Engine #1

**Goal:** driver's phone moves a marker on a student's screen.

Tasks
- [ ] Trip lifecycle: `POST /trips/start`, `POST /trips/:id/end` (bus status, occupancy reset, trip doc)
- [ ] `POST /gps/ping` (driver-only, rate-limited 1/5 s) → update `gps/{busId}` + sampled history
- [ ] Driver page: Start/End Trip buttons, `useGeolocationPublisher` hook (`watchPosition`, throttle, permission-denied & tab-hidden warnings)
- [ ] Server watchdog: no ping 60 s → bus `offline`
- [ ] Student tracking page: initial `GET /gps/:busId`, animated marker (interpolate between pings), speed, heading, route polyline, nearest stop, ETA via proxy
- [ ] Basic polling fallback (Socket.IO replaces it in Phase 7)

**Exit:** walk outside with a phone as "driver" — marker follows on another device within ~5 s; ending trip stops updates.

---

## Phase 6 — RFID Attendance & Bus Pass Validation (Week 5–6) ⚙️ Engine #2

**Goal:** card tap → validated → attendance stored → occupancy up.

Tasks
- [ ] `devices` registry + `deviceAuth` middleware (hashed API keys); provision existing readers
- [ ] `POST /rfid/tap` full pipeline (ARCHITECTURE.md §4): card exists → pass active → correct bus → duplicate-tap idempotency → batch write (attendance + occupancy++) → response drives reader LED/beep
- [ ] Bus pass service: issue / renew / revoke; daily expiry job syncs `students.passStatus`; `GET /passes/expiring`
- [ ] Boarding stop inference from latest GPS position (nearest stop)
- [ ] Admin: RFID management (assign/replace/deactivate/lost + card history via `rfidCards`), pass management, live attendance feed
- [ ] Rejection log surfaced to admin (unknown card / invalid pass / wrong bus)
- [ ] Simulator script (`hardware/simulate-tap.ts`) for development without hardware

**Exit:** simulated + real reader taps: valid card accepted once per trip, expired pass rejected, wrong bus rejected — each with correct reader feedback and admin visibility.

---

## Phase 7 — Socket.IO Real-Time Layer (Week 6–7)

**Goal:** every event above becomes push, no polling.

Tasks
- [ ] Socket.IO on the Express HTTP server; token-verified handshake; rooms `bus:{id}`, `admin`, `user:{uid}`
- [ ] Emit from services: `gps:update`, `attendance:new`, `occupancy:update`, `trip:started/ended`, `bus:offline`, `notification:new`
- [ ] Frontend `SocketContext` + `useSocket` (auto-reconnect, resubscribe, TanStack Query cache updates on events)
- [ ] Replace Phase 5 polling with `gps:update`; live occupancy/attendance on admin + driver screens

**Exit:** two browsers side-by-side — tap simulation updates admin feed and bus occupancy instantly; killing the backend and restarting reconnects sockets cleanly.

---

## Phase 8 — Student Portal (Week 7–8)

**Goal:** complete student experience.

Tasks
- [ ] Dashboard cards: assigned bus + driver, today's attendance, pass status/expiry, current bus status, live ETA to my stop
- [ ] Bus search (number / route / destination / driver) → bus detail → track
- [ ] Full tracking page (Phase 5 + 7 pieces composed)
- [ ] Attendance history: today, monthly calendar view, boarding times
- [ ] Bus pass page: status, expiry, renew-request button (creates admin notification)
- [ ] In-app notifications list + unread badge (live via socket)

**Exit:** a seeded student logs in on a phone and can find, track, and board their bus with attendance confirmation appearing in-app.

---

## Phase 9 — Driver Portal (Week 8–9)

**Goal:** complete driver experience, mobile-first.

Tasks
- [ ] Dashboard: assigned bus/route, big Start/End Trip, live student count for current trip
- [ ] Route view with stops; "Navigate" deep-link to Google Maps app with waypoints
- [ ] Boarding feed (who tapped, when, where) live during trip
- [ ] Emergency button → `notification:new` to admin room + flagged on fleet map
- [ ] Trip history: past trips, duration, boardings
- [ ] Harden GPS publishing UX: wake-lock request, "keep screen on" guidance, offline-ping queue (retry buffer)

**Exit:** full dress rehearsal — driver runs a real trip from a phone; students track; taps recorded; admin watches live.

---

## Phase 10 — Admin Dashboard Completion + Notifications (Week 9–10)

**Goal:** admin command center.

Tasks
- [ ] Overview cards (students, drivers, buses, active trips, active passes, today's attendance) — live via sockets
- [ ] Live fleet map: all active buses, offline highlighted, click → bus panel
- [ ] Charts (Recharts): daily attendance trend, bus usage, occupancy %, driver activity
- [ ] Notification system: admin broadcast composer (all / role / individual); automatic events — bus offline, bus full, card rejected, pass expiring (daily job), trip started (to that bus's students)
- [ ] "Bus near stop" geofence notification (server checks GPS vs next stop radius)
- [ ] Settings page: campus defaults, geofence radius, ping interval, pass duration

**Exit:** admin sees the whole fleet live and every automatic notification fires from a real trigger.

---

## Phase 11 — Reports & Analytics (Week 10–11)

Tasks
- [ ] Report service: daily/weekly/monthly attendance, per-student, per-bus, per-driver
- [ ] Exports: PDF (jsPDF + AutoTable, header/branding) and Excel (XLSX) — generated client-side from API data
- [ ] Analytics endpoints + dashboards: student attendance %, bus occupancy % / avg speed / trips / distance (from gpsHistory + trips), driver trips / late starts / hours, campus-wide peak hours, most/least used routes, attendance trends
- [ ] Date-range pickers, comparison views

**Exit:** admin downloads a correct monthly PDF and Excel; analytics match raw Firestore data on spot-check.

---

## Phase 12 — Security Hardening (Week 11–12)

Tasks
- [ ] Firestore rules v2: full audit, deny-by-default re-verified, rules unit tests (emulator)
- [ ] API audit: every route behind correct role guard; zod on every input; IDOR checks (student A can't read student B)
- [ ] Rate limits tuned (`/auth`, `/gps/ping`, `/rfid/tap`); helmet, CORS allowlist, request size limits
- [ ] Secrets audit — nothing in git, keys restricted (referrer/IP), service account least-privilege
- [ ] Dependency audit (`npm audit`), error handler that never leaks stack traces
- [ ] RFID device key rotation procedure documented

**Exit:** an authenticated student token cannot mutate anything or read other students' data — proven by a test script, not by inspection.

---

## Phase 13 — UI Polish & UX (Week 12–13)

Tasks
- [ ] Design pass: glassmorphism theme tokens in Tailwind, consistent spacing/typography
- [ ] Dark mode (class strategy + persisted preference)
- [ ] Framer Motion: page transitions, card entrances, live-status pulse indicators
- [ ] Loading skeletons everywhere data loads; empty states; error boundaries + toasts
- [ ] Responsive audit: student/driver portals phone-first, admin tablet+
- [ ] Accessibility pass: focus states, contrast, keyboard nav on tables/forms

**Exit:** Lighthouse ≥ 90 accessibility/best-practices on all three portals; no layout breaks 360 px–1440 px.

---

## Phase 14 — Testing, Deployment & Pilot (Week 13–14)

Tasks
- [ ] Backend integration tests (Firebase emulator): auth, RFID pipeline, trip lifecycle
- [ ] E2E happy path (Playwright): login → start trip → tap → track → report
- [ ] Deploy: frontend → Firebase Hosting; backend → Cloud Run/Render (WebSockets on, min 1 instance); `cmis-prod` Firebase project; env/secrets in host
- [ ] Point real RFID readers at prod endpoint; production seed (real routes/buses)
- [ ] Pilot: one bus, one route, one week — monitor logs, GPS gaps, tap failures
- [ ] Runbook: onboarding steps, device provisioning, incident basics

**Exit:** one real bus running daily with real students for a week; issues triaged and fixed.

---

## Phase 15 — Future / AI Roadmap (post-launch)

Groundwork already laid: `gpsHistory` + `trips` + `attendance` are the training data.

- Bus arrival prediction (historical segment times → ETA model, replacing pure Distance Matrix)
- Occupancy prediction per stop/day; route optimization from boarding patterns
- Automatic delay detection & smart notifications; driver performance scoring
- Mobile apps (React Native/Flutter) on the same backend — push notifications, background GPS, offline sync

---

## Dependency Graph

```
P1 Setup ─► P2 Auth ─► P3 Data/CRUD ─► P4 Maps/Routes ─► P5 GPS ─┐
                                    └────────────────► P6 RFID ──┤
                                                                 ▼
                                              P7 Socket.IO real-time
                                                                 ▼
                              P8 Student ── P9 Driver ── P10 Admin/Notify
                                                                 ▼
                                     P11 Reports ─► P12 Security ─► P13 UI
                                                                 ▼
                                                 P14 Deploy & Pilot ─► P15 AI
```

## Risk Register (watch early)

| Risk | Mitigation |
|---|---|
| Mobile browser kills GPS when screen locks | Wake lock + driver UX guidance (P9); native app is the real fix (P15) |
| Reader offline on the bus (no Wi-Fi) | Firmware queue-and-retry; document in P6 endpoint contract |
| Google Maps API cost creep | Server-side caching, ETA every 30 s not 5 s, polyline stored once |
| Firestore read costs from live dashboards | Socket fan-out instead of Firestore listeners (already in design) |
| Excel imports with dirty data | Row-level validation + rejects report (P3), never partial-silent imports |
