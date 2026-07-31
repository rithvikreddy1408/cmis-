import { getDb } from '../firebase/admin.js'
import { COLLECTIONS, GPS_HISTORY_SUBCOLLECTION } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { haversineKm } from '../utils/geo.js'
import { getDriverByUid } from './drivers.service.js'
import { createNotification } from './notifications.service.js'
import { emitTripStarted, emitTripEnded, emitEmergencyAlert } from '../socket/emitters.js'
import type { Bus, GpsHistoryPoint, Student, Trip } from '../types/entities.js'

async function notifyBusStudentsTripStarted(busId: string, busNumber: string) {
  const db = getDb()
  const studentsSnap = await db.collection(COLLECTIONS.students).where('busAssigned', '==', busId).get()
  const students = studentsSnap.docs.map((d) => d.data() as Student)
  if (students.length === 0) return

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
      title: 'Bus started its trip',
      message: `${busNumber} has started its trip.`,
      recipientType: 'uid',
      recipientId: snap.docs[0].id,
      type: 'trip_started',
    })
  }
}

export async function getTripForDriver(tripId: string, uid: string): Promise<Trip> {
  const driver = await getDriverByUid(uid)
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.trips).doc(tripId).get()
  if (!doc.exists) throw new HttpError(404, 'Trip not found', 'NOT_FOUND')
  const trip = doc.data() as Trip
  if (trip.driverId !== driver.driverId) {
    throw new HttpError(403, 'This trip belongs to a different driver', 'FORBIDDEN')
  }
  return trip
}

export async function getActiveTripForBus(busId: string): Promise<Trip | null> {
  const db = getDb()
  const snap = await db
    .collection(COLLECTIONS.trips)
    .where('busId', '==', busId)
    .where('status', '==', 'active')
    .limit(1)
    .get()
  return snap.empty ? null : (snap.docs[0].data() as Trip)
}

export async function getActiveTripForDriverUid(uid: string): Promise<Trip | null> {
  const driver = await getDriverByUid(uid)
  if (!driver.busAssigned) return null
  return getActiveTripForBus(driver.busAssigned)
}

export async function startTrip(uid: string): Promise<Trip> {
  const db = getDb()
  const driver = await getDriverByUid(uid)
  if (!driver.busAssigned) {
    throw new HttpError(400, 'No bus assigned to this driver', 'NO_BUS_ASSIGNED')
  }

  const existing = await getActiveTripForDriverUid(uid)
  if (existing) return existing // idempotent: refresh/re-click just returns the running trip

  const busRef = db.collection(COLLECTIONS.buses).doc(driver.busAssigned)
  const busDoc = await busRef.get()
  if (!busDoc.exists) throw new HttpError(404, 'Assigned bus not found', 'BUS_NOT_FOUND')
  const bus = busDoc.data() as Bus

  const tripRef = db.collection(COLLECTIONS.trips).doc()
  const trip: Trip = {
    tripId: tripRef.id,
    busId: bus.busId,
    driverId: driver.driverId,
    routeId: bus.routeId,
    startTime: new Date().toISOString(),
    endTime: null,
    status: 'active',
    peakOccupancy: 0,
    distanceKm: 0,
  }

  await tripRef.set(trip)
  await busRef.update({ status: 'on_trip', currentOccupancy: 0, lastUpdated: new Date().toISOString() })
  await db.collection(COLLECTIONS.drivers).doc(driver.driverId).update({ status: 'on_trip' })

  notifyBusStudentsTripStarted(bus.busId, bus.busNumber).catch((err) =>
    console.error('[trip-started-notify] error:', err),
  )

  emitTripStarted(trip.busId, trip)
  return trip
}

export async function endTrip(uid: string, tripId: string): Promise<Trip> {
  const db = getDb()
  const driver = await getDriverByUid(uid)

  const tripRef = db.collection(COLLECTIONS.trips).doc(tripId)
  const tripDoc = await tripRef.get()
  if (!tripDoc.exists) throw new HttpError(404, 'Trip not found', 'NOT_FOUND')
  const trip = tripDoc.data() as Trip

  if (trip.driverId !== driver.driverId) {
    throw new HttpError(403, 'This trip belongs to a different driver', 'FORBIDDEN')
  }
  if (trip.status !== 'active') {
    return trip // idempotent: already ended
  }

  // Best-effort distance from sampled GPS history — missing/short history just yields 0.
  let distanceKm = 0
  try {
    const historySnap = await db
      .collection(COLLECTIONS.gps)
      .doc(trip.busId)
      .collection(GPS_HISTORY_SUBCOLLECTION)
      .where('recordedAt', '>=', trip.startTime)
      .orderBy('recordedAt', 'asc')
      .get()
    const points = historySnap.docs.map((d) => d.data() as GpsHistoryPoint)
    for (let i = 1; i < points.length; i++) {
      distanceKm += haversineKm(
        { lat: points[i - 1].latitude, lng: points[i - 1].longitude },
        { lat: points[i].latitude, lng: points[i].longitude },
      )
    }
    distanceKm = Math.round(distanceKm * 10) / 10
  } catch {
    // Distance is a nice-to-have summary stat — never block trip end over it.
  }

  const updatedTrip: Trip = {
    ...trip,
    endTime: new Date().toISOString(),
    status: 'completed',
    distanceKm,
  }
  await tripRef.set(updatedTrip)

  await db.collection(COLLECTIONS.buses).doc(trip.busId).update({
    status: 'idle',
    currentOccupancy: 0,
    lastUpdated: new Date().toISOString(),
  })
  await db.collection(COLLECTIONS.drivers).doc(driver.driverId).update({ status: 'active' })
  await db.collection(COLLECTIONS.gps).doc(trip.busId).set({ tripId: null }, { merge: true })

  emitTripEnded(trip.busId, updatedTrip)
  return updatedTrip
}

export async function getTripHistoryForDriver(uid: string): Promise<Trip[]> {
  const driver = await getDriverByUid(uid)
  const db = getDb()
  const snap = await db
    .collection(COLLECTIONS.trips)
    .where('driverId', '==', driver.driverId)
    .where('status', '==', 'completed')
    .get()
  return snap.docs
    .map((d) => d.data() as Trip)
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
}

export async function raiseEmergency(uid: string, message?: string): Promise<void> {
  const driver = await getDriverByUid(uid)
  await createNotification({
    title: 'Emergency alert from driver',
    message: message?.trim()
      ? `${driver.name}: ${message.trim()}`
      : `${driver.name} raised an emergency alert on bus ${driver.busAssigned ?? 'unknown'}.`,
    recipientType: 'admin',
    type: 'emergency',
  })
  if (driver.busAssigned) {
    emitEmergencyAlert(driver.busAssigned, driver.name)
  }
}
