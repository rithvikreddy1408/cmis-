import { getDb } from '../firebase/admin.js'
import { COLLECTIONS, GPS_HISTORY_SUBCOLLECTION } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { haversineKm } from '../utils/geo.js'
import { getDriverByUid } from './drivers.service.js'
import { getActiveTripForDriverUid } from './trips.service.js'
import { createNotification } from './notifications.service.js'
import { getSettings } from './settings.service.js'
import { emitGpsUpdate, emitBusOffline } from '../socket/emitters.js'
import type { Bus, BusRoute, GpsPosition, Student } from '../types/entities.js'

const PING_MIN_INTERVAL_MS = 4_000 // guard against >1 ping per ~5s per bus
const HISTORY_SAMPLE_INTERVAL_MS = 30_000
const OFFLINE_THRESHOLD_MS = 60_000

const lastPingAt = new Map<string, number>()
const lastHistorySampleAt = new Map<string, number>()
// tripId -> set of stop names already alerted for, so students get one
// "near stop" notification per stop per trip, not one per 5s ping.
const notifiedStopsByTrip = new Map<string, Set<string>>()

interface PingInput {
  latitude: number
  longitude: number
  speed: number
  heading: number
}

export async function recordPing(uid: string, input: PingInput): Promise<GpsPosition> {
  const driver = await getDriverByUid(uid)
  if (!driver.busAssigned) {
    throw new HttpError(400, 'No bus assigned to this driver', 'NO_BUS_ASSIGNED')
  }
  const busId = driver.busAssigned

  const now = Date.now()
  const last = lastPingAt.get(busId) ?? 0
  if (now - last < PING_MIN_INTERVAL_MS) {
    throw new HttpError(429, 'Ping rate exceeded (max ~1 per 5s per bus)', 'RATE_LIMITED')
  }
  lastPingAt.set(busId, now)

  const trip = await getActiveTripForDriverUid(uid)
  if (!trip) {
    throw new HttpError(400, 'No active trip — start a trip before sending location', 'NO_ACTIVE_TRIP')
  }

  const db = getDb()
  const nowIso = new Date().toISOString()
  const position: GpsPosition = {
    busId,
    latitude: input.latitude,
    longitude: input.longitude,
    speed: input.speed,
    heading: input.heading,
    updatedAt: nowIso,
    tripId: trip.tripId,
  }

  await db.collection(COLLECTIONS.gps).doc(busId).set(position)
  await db
    .collection(COLLECTIONS.buses)
    .doc(busId)
    .update({ status: 'on_trip', lastUpdated: nowIso } as Partial<Bus>)

  const lastSample = lastHistorySampleAt.get(busId) ?? 0
  if (now - lastSample >= HISTORY_SAMPLE_INTERVAL_MS) {
    lastHistorySampleAt.set(busId, now)
    await db
      .collection(COLLECTIONS.gps)
      .doc(busId)
      .collection(GPS_HISTORY_SUBCOLLECTION)
      .add({
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed,
        heading: input.heading,
        recordedAt: nowIso,
      })
  }

  emitGpsUpdate(busId, position)
  checkGeofence(busId, trip.tripId, trip.routeId, input.latitude, input.longitude).catch((err) =>
    console.error('[geofence] error:', err),
  )

  return position
}

// Notifies a bus's students once per stop per trip when the bus comes
// within GEOFENCE_RADIUS_KM of an upcoming stop on its route.
async function checkGeofence(
  busId: string,
  tripId: string,
  routeId: string | null,
  lat: number,
  lng: number,
) {
  if (!routeId) return

  // Self-contained bounded eviction (no cross-file "trip ended" hook needed,
  // which would require importing trips.service.ts here — already imported
  // the other way round, and a two-way import cycle is worth avoiding).
  // A campus fleet runs low hundreds of trips/day at most; capping at 500
  // tracked trips keeps this from growing unbounded across a long uptime.
  if (notifiedStopsByTrip.size > 500 && !notifiedStopsByTrip.has(tripId)) {
    const oldestKey = notifiedStopsByTrip.keys().next().value
    if (oldestKey) notifiedStopsByTrip.delete(oldestKey)
  }

  const db = getDb()
  const routeDoc = await db.collection(COLLECTIONS.routes).doc(routeId).get()
  if (!routeDoc.exists) return
  const route = routeDoc.data() as BusRoute
  if (!route.stops.length) return

  const { geofenceRadiusKm } = await getSettings()
  const alreadyNotified = notifiedStopsByTrip.get(tripId) ?? new Set<string>()

  for (const stop of route.stops) {
    if (alreadyNotified.has(stop.name)) continue
    const distanceKm = haversineKm({ lat, lng }, { lat: stop.lat, lng: stop.lng })
    if (distanceKm <= geofenceRadiusKm) {
      alreadyNotified.add(stop.name)
      notifiedStopsByTrip.set(tripId, alreadyNotified)

      const studentsSnap = await db
        .collection(COLLECTIONS.students)
        .where('busAssigned', '==', busId)
        .get()
      const students = studentsSnap.docs.map((d) => d.data() as Student)
      const userDocs = await Promise.all(
        students.map((s) =>
          db
            .collection(COLLECTIONS.users)
            .where('linkedId', '==', s.studentId)
            .where('role', '==', 'student')
            .limit(1)
            .get(),
        ),
      )
      for (const snap of userDocs) {
        if (snap.empty) continue
        await createNotification({
          title: 'Bus near your stop',
          message: `Your bus is approaching ${stop.name}.`,
          recipientType: 'uid',
          recipientId: snap.docs[0].id,
          type: 'bus_near_stop',
        })
      }
    }
  }
}

export async function getLatestGps(busId: string): Promise<GpsPosition> {
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.gps).doc(busId).get()
  if (!doc.exists) {
    throw new HttpError(404, 'No GPS data for this bus yet', 'NOT_FOUND')
  }
  return doc.data() as GpsPosition
}

// One doc per bus (overwritten on every ping) — cheap full-collection scan,
// used by the admin fleet map to avoid an N+1 per-bus round trip.
export async function getAllGpsPositions(): Promise<GpsPosition[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.gps).get()
  return snap.docs.map((d) => d.data() as GpsPosition)
}

// Polls all "on_trip" buses and flips any with a stale last-ping to "offline".
// A ping arriving later naturally flips status back via recordPing above.
export function startGpsWatchdog(intervalMs = 15_000) {
  return setInterval(async () => {
    try {
      const db = getDb()
      const snap = await db.collection(COLLECTIONS.buses).where('status', '==', 'on_trip').get()
      const now = Date.now()
      for (const doc of snap.docs) {
        const bus = doc.data() as Bus
        const gpsDoc = await db.collection(COLLECTIONS.gps).doc(bus.busId).get()
        const gps = gpsDoc.data() as GpsPosition | undefined
        const lastUpdate = gps?.updatedAt ? new Date(gps.updatedAt).getTime() : 0
        if (now - lastUpdate > OFFLINE_THRESHOLD_MS) {
          await doc.ref.update({ status: 'offline' })
          emitBusOffline(bus.busId)
          await createNotification({
            title: 'Bus went offline',
            message: `${bus.busNumber} has not reported its location in over a minute.`,
            recipientType: 'admin',
            type: 'bus_offline',
          })
        }
      }
    } catch (err) {
      console.error('[gps-watchdog] error:', err)
    }
  }, intervalMs)
}
