import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { initializeApp, applicationDefault, cert, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Trips and attendance have no admin-facing delete endpoint by design —
// they're meant to be permanent audit records in production. The E2E suite
// runs its "tap -> trip" flow against the real project repeatedly though,
// so it needs a way to purge exactly what it created. Nothing else in the
// frontend touches Firestore directly; this exists only for test teardown.
let app: App | null = null

function getApp(): App {
  if (app) return app
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    app = initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-cmis-test' })
    return app
  }
  const jsonEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (jsonEnv) {
    app = initializeApp({ credential: cert(JSON.parse(jsonEnv)) })
    return app
  }
  const here = dirname(fileURLToPath(import.meta.url))
  const backendKeyPath = resolve(here, '../../backend/serviceAccountKey.json')
  if (existsSync(backendKeyPath)) {
    app = initializeApp({ credential: cert(backendKeyPath) })
    return app
  }
  app = initializeApp({ credential: applicationDefault() })
  return app
}

export async function cleanupTripArtifacts(opts: {
  rfidUID?: string
  tripId?: string
  busNumber?: string
  busId?: string
}) {
  const db = getFirestore(getApp())

  // Each section runs independently — a failure in one (a transient
  // network blip, one of several concurrent deletes rejecting) must not
  // skip the others. Sequential `await`s in one function without this
  // would mean one early failure silently aborts everything after it;
  // that's exactly how a load-testing script's cleanup left real orphaned
  // fixtures behind despite logging "Done" — same class of bug, fixed the
  // same way here.
  async function section(name: string, fn: () => Promise<unknown>) {
    try {
      await fn()
    } catch (err) {
      console.warn(`[firestore-cleanup] ${name} failed:`, err)
    }
  }

  if (opts.rfidUID) {
    await section('rfidCard delete', () => db.collection('rfidCards').doc(opts.rfidUID!).delete())
  }
  if (opts.tripId) {
    await section('attendance + trip delete', async () => {
      const attendanceSnap = await db
        .collection('attendance')
        .where('tripId', '==', opts.tripId)
        .get()
      await Promise.allSettled(attendanceSnap.docs.map((d) => d.ref.delete()))
      await db.collection('trips').doc(opts.tripId!).delete()
    })
  }
  if (opts.busId) {
    // gps/{busId} is a separate collection keyed by busId, not
    // cascade-deleted with the bus doc — endTrip writes {tripId: null}
    // here independently when the driver ends the trip.
    await section('gps doc delete', () => db.collection('gps').doc(opts.busId!).delete())
  }
  if (opts.busNumber) {
    // The GPS watchdog runs independently of this test and doesn't know
    // the bus is a disposable E2E fixture — if the bus goes 60s without a
    // ping (the E2E flow never simulates driver GPS, only the RFID tap)
    // it fires a real "bus went offline" notification with no delete
    // endpoint of its own. Sweep for it by bus number, same reasoning as
    // trips/attendance above.
    await section('notification sweep', async () => {
      const notifSnap = await db.collection('notifications').get()
      await Promise.allSettled(
        notifSnap.docs
          .filter((d) => (d.data().message as string | undefined)?.includes(opts.busNumber!))
          .map((d) => d.ref.delete()),
      )
    })
  }
}
