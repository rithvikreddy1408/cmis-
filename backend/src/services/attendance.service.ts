import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { haversineKm } from '../utils/geo.js'
import { getActiveTripForBus } from './trips.service.js'
import { createNotification } from './notifications.service.js'
import { emitAttendanceNew, emitOccupancyUpdate } from '../socket/emitters.js'
import type {
  AttendanceRecord,
  Bus,
  BusRoute,
  GpsPosition,
  RfidCard,
  Student,
  TapRejectReason,
  Trip,
} from '../types/entities.js'

export interface TapResult {
  status: 'ACCEPTED'
  studentName: string
  boardingStop: string | null
  alreadyBoarded: boolean
}

async function logRejection(deviceId: string, busId: string, rfidUID: string, reason: TapRejectReason) {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.tapRejections).doc()
  await ref.set({
    rejectionId: ref.id,
    deviceId,
    busId,
    rfidUID,
    reason,
    at: new Date().toISOString(),
  })
  await createNotification({
    title: 'RFID tap rejected',
    message: `Card ${rfidUID} rejected on bus (${reason}).`,
    recipientType: 'admin',
    type: 'card_rejected',
  })
}

function reject(deviceId: string, busId: string, rfidUID: string, reason: TapRejectReason): never {
  logRejection(deviceId, busId, rfidUID, reason).catch(() => {})
  const messages: Record<TapRejectReason, string> = {
    UNKNOWN_CARD: 'Card not recognized',
    CARD_LOST: 'Card reported lost',
    CARD_DEACTIVATED: 'Card deactivated',
    PASS_INVALID: 'Bus pass is not active',
    WRONG_BUS: 'Student is not assigned to this bus',
    NO_ACTIVE_TRIP: 'No active trip for this bus right now',
  }
  throw new HttpError(422, messages[reason], reason)
}

async function findNearestStop(bus: Bus, gps: GpsPosition | null): Promise<string | null> {
  if (!bus.routeId || !gps) return null
  const db = getDb()
  const routeDoc = await db.collection(COLLECTIONS.routes).doc(bus.routeId).get()
  if (!routeDoc.exists) return null
  const route = routeDoc.data() as BusRoute
  if (route.stops.length === 0) return null

  const here = { lat: gps.latitude, lng: gps.longitude }
  let nearest = route.stops[0]
  let nearestDist = haversineKm(here, { lat: nearest.lat, lng: nearest.lng })
  for (const stop of route.stops.slice(1)) {
    const dist = haversineKm(here, { lat: stop.lat, lng: stop.lng })
    if (dist < nearestDist) {
      nearest = stop
      nearestDist = dist
    }
  }
  return nearest.name
}

export async function recordTap(deviceId: string, busId: string, rfidUID: string): Promise<TapResult> {
  const db = getDb()

  // These four only need busId/rfidUID — both known up front, none
  // depends on another's result — so they're fired together instead of
  // sequentially. Real load test (`npm run loadtest`) measured ~2.7-3s per
  // concurrent tap before this change; the four round trips below were
  // the bulk of it. The cost on the reject path (a couple of reads done
  // that end up unused) is negligible against the latency win on the far
  // more common accept path.
  const busRef = db.collection(COLLECTIONS.buses).doc(busId)
  const [cardDoc, trip, busDoc, gpsDoc] = await Promise.all([
    db.collection(COLLECTIONS.rfidCards).doc(rfidUID).get(),
    getActiveTripForBus(busId),
    busRef.get(),
    db.collection(COLLECTIONS.gps).doc(busId).get(),
  ])

  if (!cardDoc.exists) reject(deviceId, busId, rfidUID, 'UNKNOWN_CARD')
  const card = cardDoc.data() as RfidCard
  if (card.status === 'lost') reject(deviceId, busId, rfidUID, 'CARD_LOST')
  if (card.status === 'deactivated') reject(deviceId, busId, rfidUID, 'CARD_DEACTIVATED')

  const studentDoc = await db.collection(COLLECTIONS.students).doc(card.studentId).get()
  if (!studentDoc.exists) reject(deviceId, busId, rfidUID, 'UNKNOWN_CARD')
  const student = studentDoc.data() as Student

  if (student.passStatus !== 'active') reject(deviceId, busId, rfidUID, 'PASS_INVALID')
  if (student.busAssigned !== busId) reject(deviceId, busId, rfidUID, 'WRONG_BUS')

  if (!trip) reject(deviceId, busId, rfidUID, 'NO_ACTIVE_TRIP')

  // Idempotency: same student tapping again on the same trip doesn't double-count.
  const existingSnap = await db
    .collection(COLLECTIONS.attendance)
    .where('tripId', '==', (trip as Trip).tripId)
    .where('studentId', '==', student.studentId)
    .limit(1)
    .get()
  if (!existingSnap.empty) {
    return { status: 'ACCEPTED', studentName: student.name, boardingStop: null, alreadyBoarded: true }
  }

  const bus = busDoc.data() as Bus
  const gps = gpsDoc.exists ? (gpsDoc.data() as GpsPosition) : null
  const boardingStop = await findNearestStop(bus, gps)

  const now = new Date()
  const attendanceRef = db.collection(COLLECTIONS.attendance).doc()
  const record: AttendanceRecord = {
    attendanceId: attendanceRef.id,
    studentId: student.studentId,
    busId,
    tripId: (trip as Trip).tripId,
    rfidUID,
    boardingTime: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    boardingStop,
  }

  const batch = db.batch()
  batch.set(attendanceRef, record)
  batch.update(busRef, { currentOccupancy: (bus.currentOccupancy ?? 0) + 1 })
  const tripRef = db.collection(COLLECTIONS.trips).doc((trip as Trip).tripId)
  batch.update(tripRef, {
    peakOccupancy: Math.max((trip as Trip).peakOccupancy, (bus.currentOccupancy ?? 0) + 1),
  })
  await batch.commit()

  const newOccupancy = (bus.currentOccupancy ?? 0) + 1
  emitAttendanceNew(busId, record)
  emitOccupancyUpdate(busId, newOccupancy, bus.capacity)

  if (newOccupancy >= bus.capacity) {
    createNotification({
      title: 'Bus full',
      message: `${bus.busNumber} is at capacity (${newOccupancy}/${bus.capacity}).`,
      recipientType: 'admin',
      type: 'bus_full',
    }).catch(() => {})
  }

  return { status: 'ACCEPTED', studentName: student.name, boardingStop, alreadyBoarded: false }
}

export async function getAttendanceForBusToday(busId: string): Promise<AttendanceRecord[]> {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)
  const snap = await db
    .collection(COLLECTIONS.attendance)
    .where('busId', '==', busId)
    .where('date', '==', today)
    .get()
  return snap.docs
    .map((d) => d.data() as AttendanceRecord)
    .sort((a, b) => new Date(b.boardingTime).getTime() - new Date(a.boardingTime).getTime())
}

// month, if given, is a 'YYYY-MM' prefix filter over the denormalized `date`
// field. Single equality filter only — filtered/sorted in memory to avoid
// needing a composite index for studentId + date range + orderBy.
export async function getAttendanceHistoryForStudent(
  studentId: string,
  month?: string,
): Promise<AttendanceRecord[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.attendance).where('studentId', '==', studentId).get()
  let records = snap.docs.map((d) => d.data() as AttendanceRecord)
  if (month) {
    records = records.filter((r) => r.date.startsWith(month))
  }
  records.sort((a, b) => b.boardingTime.localeCompare(a.boardingTime))
  return records
}

export interface TripBoardingEntry {
  studentName: string
  rollNumber: string
  boardingTime: string
  boardingStop: string | null
}

export async function getBoardingFeedForTrip(tripId: string): Promise<TripBoardingEntry[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.attendance).where('tripId', '==', tripId).get()
  const records = snap.docs.map((d) => d.data() as AttendanceRecord)

  const students = await Promise.all(
    records.map((r) => db.collection(COLLECTIONS.students).doc(r.studentId).get()),
  )
  const nameById = new Map(
    students.filter((s) => s.exists).map((s) => [s.id, s.data() as Student]),
  )

  return records
    .map((r) => {
      const student = nameById.get(r.studentId)
      return {
        studentName: student?.name ?? 'Unknown',
        rollNumber: student?.rollNumber ?? '—',
        boardingTime: r.boardingTime,
        boardingStop: r.boardingStop,
      }
    })
    .sort((a, b) => b.boardingTime.localeCompare(a.boardingTime))
}

export async function getRecentRejections(limit = 50) {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.tapRejections).orderBy('at', 'desc').limit(limit).get()
  return snap.docs.map((d) => d.data())
}
