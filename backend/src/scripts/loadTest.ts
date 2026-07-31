// Real load test against a real (not emulated) Firestore project — creates
// its own fleet-sized set of fixtures, hammers the endpoints that matter
// most under real campus-morning load, measures real latency, and cleans
// up after itself. Run with: npm run loadtest
//
// Scenarios:
//   1. Concurrent RFID taps — one fleet's worth of buses/devices/students
//      all tapping at once (the "morning rush" case: many buses, each with
//      one reader, all firing around the same few minutes).
//   2. Concurrent dashboard reads — many admin sessions loading the
//      dashboard's four queries at once (the "everyone checks during a
//      fire drill" case).
import 'dotenv/config'
import autocannon from 'autocannon'
import { getDb } from '../firebase/admin.js'
import { generateDeviceKey, hashDeviceKey } from '../utils/deviceKey.js'

const FLEET_SIZE = Number(process.env.LOADTEST_FLEET_SIZE) || 20
const API_BASE = process.env.LOADTEST_API_BASE ?? 'http://localhost:4100/api/v1'
const RUN_ID = Date.now().toString(36)

interface Fixture {
  busId: string
  driverId: string
  studentId: string
  deviceId: string
  rawKey: string
  rfidUID: string
  tripId: string
}

async function setup(): Promise<Fixture[]> {
  const db = getDb()
  const fixtures: Fixture[] = []

  console.log(`Setting up ${FLEET_SIZE} buses/drivers/students/devices/trips...`)
  for (let i = 0; i < FLEET_SIZE; i++) {
    const busRef = db.collection('buses').doc()
    const driverRef = db.collection('drivers').doc()
    const studentRef = db.collection('students').doc()
    const deviceRef = db.collection('devices').doc()
    const rfidUID = `LOADTEST-${RUN_ID}-${i}`
    const tripRef = db.collection('trips').doc()
    const rawKey = generateDeviceKey()
    const now = new Date().toISOString()

    await busRef.set({
      busId: busRef.id,
      busNumber: `LOADTEST-${RUN_ID}-${i}`,
      driverId: driverRef.id,
      routeId: null,
      capacity: 60,
      currentOccupancy: 0,
      status: 'on_trip',
      lastUpdated: now,
      createdAt: now,
    })
    await driverRef.set({
      driverId: driverRef.id,
      name: `Load Test Driver ${i}`,
      phone: '9000000000',
      email: `loadtest.driver.${RUN_ID}.${i}@example.com`,
      busAssigned: busRef.id,
      routeAssigned: null,
      licenseNumber: `LOADTEST-LIC-${RUN_ID}-${i}`,
      status: 'on_trip',
      createdAt: now,
    })
    await studentRef.set({
      studentId: studentRef.id,
      rollNumber: `LOADTEST${RUN_ID}${i}`,
      name: `Load Test Student ${i}`,
      branch: 'CSE',
      year: 2,
      section: 'A',
      phone: '9000000000',
      email: `loadtest.student.${RUN_ID}.${i}@example.com`,
      rfidUID,
      busAssigned: busRef.id,
      routeId: null,
      passStatus: 'active',
      passExpiry: null,
      createdAt: now,
    })
    await db.collection('rfidCards').doc(rfidUID).set({
      rfidUID,
      studentId: studentRef.id,
      status: 'active',
      assignedAt: now,
      history: [{ event: 'assigned', at: now, note: null }],
    })
    await deviceRef.set({
      deviceId: deviceRef.id,
      busId: busRef.id,
      apiKeyHash: hashDeviceKey(rawKey),
      lastSeen: null,
      createdAt: now,
    })
    await tripRef.set({
      tripId: tripRef.id,
      busId: busRef.id,
      driverId: driverRef.id,
      routeId: null,
      startTime: now,
      endTime: null,
      status: 'active',
      peakOccupancy: 0,
      distanceKm: 0,
    })

    fixtures.push({
      busId: busRef.id,
      driverId: driverRef.id,
      studentId: studentRef.id,
      deviceId: deviceRef.id,
      rawKey,
      rfidUID,
      tripId: tripRef.id,
    })
  }
  return fixtures
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]!
}

async function tapScenario(fixtures: Fixture[]) {
  console.log(`\n=== Scenario 1: ${fixtures.length} buses tapping concurrently ===`)
  const latencies: number[] = []
  let ok = 0
  let failed = 0

  const results = await Promise.all(
    fixtures.map(async (f) => {
      const start = performance.now()
      try {
        const res = await fetch(`${API_BASE}/rfid/tap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': f.deviceId,
            'X-Device-Key': f.rawKey,
          },
          body: JSON.stringify({ rfidUID: f.rfidUID }),
        })
        const elapsed = performance.now() - start
        return { ok: res.ok, status: res.status, elapsed }
      } catch (err) {
        return { ok: false, status: 0, elapsed: performance.now() - start, err }
      }
    }),
  )

  for (const r of results) {
    latencies.push(r.elapsed)
    if (r.ok) ok++
    else failed++
  }

  latencies.sort((a, b) => a - b)
  console.log(`Requests: ${results.length}  OK: ${ok}  Failed: ${failed}`)
  console.log(
    `Latency (ms) — min: ${latencies[0]?.toFixed(0)}  p50: ${percentile(latencies, 50).toFixed(0)}  ` +
      `p95: ${percentile(latencies, 95).toFixed(0)}  max: ${latencies[latencies.length - 1]?.toFixed(0)}`,
  )
  const failedSamples = results.filter((r) => !r.ok).slice(0, 3)
  if (failedSamples.length) console.log('Sample failures:', failedSamples)
}

async function dashboardScenario() {
  console.log('\n=== Scenario 2: concurrent dashboard reads ===')
  const email = process.env.LOADTEST_ADMIN_EMAIL
  const password = process.env.LOADTEST_ADMIN_PASSWORD
  const webApiKey = process.env.LOADTEST_FIREBASE_API_KEY
  if (!email || !password || !webApiKey) {
    console.log(
      'Skipped — set LOADTEST_ADMIN_EMAIL, LOADTEST_ADMIN_PASSWORD, and ' +
        'LOADTEST_FIREBASE_API_KEY (the same web API key frontend/.env uses) to run this scenario.',
    )
    return
  }
  // Plain password sign-in against the real Auth REST API — the same
  // thing a real client does on login, and the same approach the E2E
  // suite already uses. Deliberately not `createCustomToken`, which needs
  // the IAM Service Account Credentials API enabled on the GCP project;
  // that's disabled here (same gap documented in SECURITY.md for
  // Firestore rules deployment) and out of this script's control to fix.
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${webApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  if (!signInRes.ok) {
    console.log(`Skipped — admin sign-in failed: ${signInRes.status} ${await signInRes.text()}`)
    return
  }
  const { idToken } = (await signInRes.json()) as { idToken: string }

  const result = await autocannon({
    url: `${API_BASE}/dashboard/overview`,
    connections: 50,
    duration: 10,
    headers: { Authorization: `Bearer ${idToken}` },
  })
  console.log(
    `Requests: ${result.requests.total}  Errors: ${result.errors}  ` +
      `Latency p50: ${result.latency.p50}ms  p95: ${result.latency.p97_5}ms  p99: ${result.latency.p99}ms  ` +
      `Throughput: ${result.requests.average}/sec`,
  )
}

async function cleanup(fixtures: Fixture[]) {
  console.log(`\nCleaning up ${fixtures.length} fixtures...`)
  const db = getDb()
  const batchOps: Promise<unknown>[] = []
  for (const f of fixtures) {
    batchOps.push(db.collection('buses').doc(f.busId).delete())
    batchOps.push(db.collection('drivers').doc(f.driverId).delete())
    batchOps.push(db.collection('students').doc(f.studentId).delete())
    batchOps.push(db.collection('devices').doc(f.deviceId).delete())
    batchOps.push(db.collection('rfidCards').doc(f.rfidUID).delete())
    batchOps.push(db.collection('trips').doc(f.tripId).delete())
    // gps/{busId} is a separate collection keyed by busId, not
    // cascade-deleted with the bus doc — endTrip (and, here, the GPS
    // watchdog) can write to it independently of anything else this
    // script created.
    batchOps.push(db.collection('gps').doc(f.busId).delete())
  }
  // Fetched and filtered in memory rather than `where(... 'in', ids)` —
  // that operator caps out well below a fleet-sized batch, and both
  // collections are small enough that scanning them is cheap.
  const fixtureStudentIds = new Set(fixtures.map((f) => f.studentId))
  const attendanceSnap = await db.collection('attendance').get()
  attendanceSnap.docs
    .filter((d) => fixtureStudentIds.has(d.data().studentId))
    .forEach((d) => batchOps.push(d.ref.delete()))

  // The GPS watchdog runs independently of this script and doesn't know
  // these buses are disposable fixtures — if it flags one "offline" mid-run
  // (this script never simulates real GPS pings, only RFID taps and a
  // dashboard read burst) it fires a real notification with no delete
  // endpoint of its own. Every fixture shares RUN_ID, so one substring
  // filter catches all of them regardless of which bus triggered it.
  const notifSnap = await db.collection('notifications').get()
  notifSnap.docs
    .filter((d) => (d.data().message as string | undefined)?.includes(RUN_ID))
    .forEach((d) => batchOps.push(d.ref.delete()))

  // allSettled, not all — cleanup is best-effort by nature. `Promise.all`
  // is fail-fast: one transient network error on any single delete (real
  // risk across ~150 concurrent requests over a real internet-bound
  // Firestore project) rejects immediately, and since main() calls
  // process.exit(1) on that rejection, every OTHER still-in-flight delete
  // gets abandoned mid-request — this is precisely how a handful of
  // fixtures ended up surviving a "successful"-looking run in practice.
  const results = await Promise.allSettled(batchOps)
  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length > 0) {
    console.warn(`${failed.length}/${results.length} cleanup operations failed:`)
    failed.slice(0, 5).forEach((r) => console.warn(' -', (r as PromiseRejectedResult).reason))
  }
  console.log(`Done (${results.length - failed.length}/${results.length} succeeded).`)
}

async function main() {
  const fixtures = await setup()
  try {
    await tapScenario(fixtures)
    await dashboardScenario()
  } finally {
    await cleanup(fixtures)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
