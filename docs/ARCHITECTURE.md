# CMIS — Complete Build Architecture

Campus Mobility Intelligence and IoT Management System

---

## 1. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                  │
│                                                                    │
│  Admin Dashboard      Student Portal       Driver Portal           │
│  (React SPA)          (React SPA)          (React SPA, mobile-web) │
│        │                    │                     │                │
└────────┼────────────────────┼─────────────────────┼────────────────┘
         │  HTTPS (REST)      │  WebSocket           │ geolocation
         ▼                    ▼  (Socket.IO)         ▼
┌────────────────────────────────────────────────────────────────────┐
│                     BACKEND — Node.js + Express                    │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐    │
│  │ REST API     │  │ Socket.IO    │  │ RFID Ingest Endpoint  │    │
│  │ /api/v1/*    │  │ Gateway      │  │ POST /api/v1/rfid/tap │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘    │
│         │                 │                     │                 │
│  ┌──────▼─────────────────▼─────────────────────▼────────────┐    │
│  │ Middleware: Auth (Firebase ID token) → Role Guard → Validation│ │
│  └──────┬────────────────────────────────────────────────────┘    │
│         │                                                          │
│  ┌──────▼──────────────────────────────────────────────────┐      │
│  │ Services: StudentSvc · DriverSvc · BusSvc · RouteSvc     │      │
│  │ AttendanceSvc · PassSvc · TripSvc · GpsSvc · NotifySvc   │      │
│  │ ReportSvc · AnalyticsSvc · ImportExportSvc               │      │
│  └──────┬──────────────────────────────────────────────────┘      │
└─────────┼──────────────────────────────────────────────────────────┘
          ▼
┌────────────────────────────────────────────────────────────────────┐
│              FIREBASE (Admin SDK from backend)                     │
│  Firestore (data) · Firebase Auth (identity + custom role claims) │
└────────────────────────────────────────────────────────────────────┘

External: Google Maps JS API (frontend) · Directions / Geocoding /
Distance Matrix APIs (backend proxy, key kept server-side)

Hardware: RFID Reader (ESP32/Arduino) → HTTP POST with device API key
```

### Key architectural decisions

1. **Backend-mediated writes.** Clients never write attendance, GPS, occupancy, or pass data directly to Firestore. All mutations go through Express so business rules (pass validation, occupancy limits, role checks) are enforced in one place. Firestore Security Rules are the second line of defense.
2. **Socket.IO for fan-out, Firestore for persistence.** GPS pings and attendance events hit the backend, are persisted to Firestore, and are simultaneously broadcast over Socket.IO rooms. Students subscribed to a bus room get sub-second updates without Firestore read costs per viewer.
3. **Roles via Firebase custom claims.** `role` (`super_admin` | `transport_admin` | `driver` | `student`) is set with the Admin SDK at account creation. Both Express middleware and Firestore rules read the same claim — no duplicated role tables.
   The seeded super admin creates transport-admin accounts. Transport admins create student and driver accounts through their domain forms; those flows link the Firebase identity to its student/driver record and issue a temporary password. Generic registration cannot grant a role or link an arbitrary student/driver profile.
4. **Google server-side APIs proxied.** Directions/Geocoding/Distance Matrix calls go through the backend (`/api/v1/maps/*`) so the unrestricted server key never ships to the browser. The browser only gets the referrer-restricted Maps JS key.
5. **RFID devices authenticate with device API keys**, not Firebase Auth. Each reader has a `deviceId` + secret stored hashed in Firestore; the tap endpoint validates it before processing.

---

## 2. Repository / Folder Structure

```
CMIS/
├── frontend/
│   ├── src/
│   │   ├── components/          # shared UI: Button, Card, Modal, Table,
│   │   │   ├── ui/              #   Skeleton, StatusBadge, ThemeToggle
│   │   │   ├── layout/          # AppShell, Sidebar, Topbar per role
│   │   │   ├── maps/            # BusMarker, RoutePolyline, FleetMap
│   │   │   └── charts/          # AttendanceChart, OccupancyChart
│   │   ├── pages/
│   │   │   ├── auth/            # Login, ForgotPassword
│   │   │   ├── admin/           # Dashboard, Students, Drivers, Buses,
│   │   │   │                    #   Routes, Rfid, Passes, Reports, Settings
│   │   │   ├── student/         # Dashboard, Search, Track, Attendance, Pass
│   │   │   └── driver/          # Dashboard, Trip, Navigation, History
│   │   ├── hooks/               # useAuth, useSocket, useBusLocation,
│   │   │                        #   useGeolocationPublisher, useDebounce
│   │   ├── services/            # api.ts (axios), students.api.ts, ...
│   │   ├── context/             # AuthContext, SocketContext, ThemeContext
│   │   ├── routes/              # router.tsx, ProtectedRoute, RoleRoute
│   │   ├── types/               # shared TS interfaces (mirror Firestore)
│   │   └── utils/               # formatters, exporters (xlsx/pdf), geo math
│   ├── .env                     # VITE_API_URL, VITE_FIREBASE_*, VITE_MAPS_KEY
│   └── vite.config.ts
│
├── backend/
│   ├── src/
│   │   ├── routes/              # auth, students, drivers, buses, routes,
│   │   │                        #   attendance, passes, trips, gps, rfid,
│   │   │                        #   reports, notifications, maps
│   │   ├── controllers/         # thin: parse → call service → respond
│   │   ├── services/            # all business logic + Firestore access
│   │   ├── middleware/          # verifyToken, requireRole, deviceAuth,
│   │   │                        #   validate(zod), errorHandler, rateLimit
│   │   ├── socket/              # index.ts (auth handshake), rooms.ts, emitters.ts
│   │   ├── firebase/            # admin init, firestore refs, collection names
│   │   ├── utils/               # excel parser, pdf builder, date helpers
│   │   └── uploads/             # multer temp dir (gitignored)
│   ├── .env                     # PORT, FIREBASE_SERVICE_ACCOUNT, MAPS_SERVER_KEY
│   └── server.ts                # Express + Socket.IO on one http server
│
├── hardware/
│   └── rfid-firmware/           # existing reader code + endpoint contract doc
│
├── firestore.rules
├── firestore.indexes.json
└── docs/
    ├── ARCHITECTURE.md          # this file
    └── BUILD_PLAN.md
```

---

## 3. Firestore Data Model

Collection names in one constants file, shared shape in `types/`.

| Collection | Doc ID | Key fields | Notes |
|---|---|---|---|
| `users` | Firebase UID | role, linkedId (studentId/driverId), email, displayName | Bridges Auth ↔ domain docs |
| `students` | studentId | rollNumber, name, branch, year, section, phone, email, rfidUID, busAssigned, routeId, passStatus, passExpiry, createdAt | `rfidUID` indexed (unique, enforced in service) |
| `drivers` | driverId | name, phone, email, busAssigned, routeAssigned, licenseNumber, status | status: active/inactive/on_trip |
| `buses` | busId | busNumber, driverId, routeId, capacity, currentOccupancy, status, lastUpdated | status: idle/on_trip/offline/maintenance |
| `routes` | routeId | routeName, startPoint, destination, stops[] {name, lat, lng, order}, distance, expectedTime, polyline | polyline cached from Directions API |
| `attendance` | auto | studentId, busId, tripId, rfidUID, boardingTime, date (YYYY-MM-DD), boardingStop | Composite indexes: (busId,date), (studentId,date) |
| `busPasses` | passId | studentId, issuedDate, expiryDate, status | status: active/expired/revoked; history kept, `students.passStatus` is denormalized cache |
| `trips` | tripId | busId, driverId, routeId, startTime, endTime, status, peakOccupancy, distanceKm | One doc per trip; attendance references tripId |
| `gps` | busId (latest) | latitude, longitude, speed, heading, updatedAt, tripId | One "latest" doc per bus, overwritten each ping; optional `gpsHistory` subcollection sampled every 30s for analytics |
| `rfidCards` | rfidUID | studentId, status (active/lost/deactivated), assignedAt, history[] | Card lifecycle + reassignment audit |
| `devices` | deviceId | busId, apiKeyHash, lastSeen | RFID reader registry |
| `notifications` | auto | title, message, recipientType (all/role/uid), recipientId, type, read, createdAt | |

**Denormalization strategy:** student docs carry `busAssigned`/`passStatus` so the RFID tap path does **one read** (`rfidCards/{uid}` → `students/{id}`) instead of joins. Pass renewal/expiry services keep the cache in sync.

---

## 4. Backend API Surface (`/api/v1`)

| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /auth/register` (super admin creates transport admins), `GET /auth/me` | super admin / any |
| Students | CRUD `/students`, `POST /students/import` (xlsx), `GET /students/export`, `POST /students/:id/assign-rfid`, `/assign-bus` | admin |
| Drivers | CRUD `/drivers`, `POST /drivers/:id/assign-bus` | admin |
| Buses | CRUD `/buses`, `GET /buses/search?q=` | admin (write), all (read) |
| Routes | CRUD `/routes`, `POST /routes/preview` (Directions proxy) | admin (write), all (read) |
| Trips | `POST /trips/start`, `POST /trips/:id/end`, `GET /trips/history` | driver |
| GPS | `POST /gps/ping` (driver, ≤1 per 5s), `GET /gps/:busId` | driver / all |
| RFID | `POST /rfid/tap` {deviceId, rfidUID} | device key |
| Attendance | `GET /attendance?busId&date`, `?studentId&month` | admin / owner |
| Passes | `POST /passes/issue`, `/renew`, `/revoke`, `GET /passes/expiring` | admin |
| Reports | `GET /reports/{daily,weekly,monthly}?format=pdf|xlsx` | admin |
| Analytics | `GET /analytics/{overview,bus/:id,student/:id,driver/:id}` | admin / owner |
| Notifications | `GET /notifications`, `POST /notifications` (admin broadcast) | per role |
| Maps proxy | `GET /maps/eta`, `/maps/geocode`, `/maps/directions` | authenticated |

**RFID tap pipeline** (the critical path, target < 300 ms):

```
POST /rfid/tap → deviceAuth → lookup rfidCards/{uid}
  → card missing/lost?            reject "UNKNOWN_CARD"
  → student.passStatus != active? reject "PASS_INVALID"
  → student.busAssigned != device.busId? reject "WRONG_BUS"
  → duplicate tap this trip?      idempotent OK (no double count)
  → Firestore batch: attendance doc + bus.currentOccupancy++ 
  → emit socket: attendance:new (bus room + admin room)
  → notify student "Boarding confirmed"
  → 200 {status:"ACCEPTED", studentName}   # reader shows green/red LED
```

---

## 5. Socket.IO Design

- **Handshake:** client sends Firebase ID token in `auth`; server verifies, attaches `{uid, role}`.
- **Rooms:** `bus:{busId}` (students tracking that bus + its driver), `admin` (dashboard), `user:{uid}` (personal notifications).

| Event (server → client) | Room | Payload |
|---|---|---|
| `gps:update` | bus:{id}, admin | lat, lng, speed, heading, ts |
| `attendance:new` | bus:{id}, admin | studentName, stop, occupancy |
| `occupancy:update` | bus:{id}, admin | current, capacity |
| `trip:started` / `trip:ended` | bus:{id}, admin | tripId, busId, ts |
| `notification:new` | user:{uid} / admin | notification doc |
| `bus:offline` | admin | busId (no ping for 60s — watchdog interval on server) |

Client → server: `subscribe:bus {busId}`, `unsubscribe:bus`. GPS pings go over **REST**, not sockets, so the driver page survives socket drops and pings stay rate-limited and auditable.

---

## 6. Live Tracking Flow

```
Driver taps "Start Trip"
 → POST /trips/start → trip doc created, bus.status=on_trip → trip:started
 → frontend: navigator.geolocation.watchPosition (highAccuracy)
 → throttled to 1 POST /gps/ping per 5s
 → backend: update gps/{busId}, append sampled history, compute ETA to next
   stop via Distance Matrix (cached 30s), emit gps:update
Student "Track Bus" (their assigned bus only)
 → GET /gps/:busId (initial position) + authorized subscribe:bus
 → Maps JS: animated marker interpolates between pings, route polyline
   from routes.polyline, nearest-stop + ETA labels
"End Trip" → POST /trips/:id/end → bus idle, occupancy reset, GPS stops
```

Edge handling: page-visibility warning to driver if tab backgrounds; server watchdog marks bus `offline` and alerts admins after 60 s of silence.

---

## 7. Security Model

1. **Firebase Auth** — email/password; the super admin creates transport admins, and transport admins create linked driver/student accounts (bulk-created on Excel import with temporary passwords). Students sign in with the issued email and temporary password, then see their assigned bus and route.
2. **Custom claims** — single source of role truth; Express `requireRole(...)` and Firestore rules both read it.
3. **Assignment-scoped reads** — student bus, route, GPS, and Socket.IO subscriptions are checked against the student's assigned bus. Drivers receive the same checks for their assigned bus. Admins retain fleet-wide visibility.
4. **Firestore rules** — deny-by-default; **all writes only via Admin SDK** (rules block client writes to operational collections).
5. **Device auth** — RFID readers use per-device hashed API keys; tap endpoint rate-limited.
6. **Transport & keys** — HTTPS everywhere; server Maps key never in frontend; browser Maps key referrer-restricted; all secrets in `.env` (gitignored) / hosting secret manager.
7. **Input validation** — zod schemas on every route; Excel imports validated row-by-row with a rejects report.
8. **Rate limiting** — global + strict on `/auth`, `/gps/ping`, `/rfid/tap`.

---

## 8. Deployment Topology

| Piece | Target |
|---|---|
| Frontend | Firebase Hosting (or Vercel) — static Vite build |
| Backend | Cloud Run / Render / Railway — one container, Express + Socket.IO (enable WebSocket support & min-instances=1 so sockets stay warm) |
| Firestore + Auth | Firebase project (`cmis-dev`, `cmis-prod` pair) |
| RFID readers | Campus Wi-Fi → HTTPS POST to backend |

CI: GitHub Actions — lint + typecheck + build on PR; deploy on merge to `main`.
