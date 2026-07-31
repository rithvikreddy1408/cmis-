import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import type { AttendanceRecord, Bus, Driver, Trip } from '../types/entities.js'

export interface OverviewStats {
  totalStudents: number
  totalDrivers: number
  totalBuses: number
  activeTrips: number
  activePasses: number
  todayAttendance: number
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  // Firestore count() aggregation — server-side count, no document reads.
  const [students, drivers, buses, activeTrips, activePasses, todayAttendance] = await Promise.all([
    db.collection(COLLECTIONS.students).count().get(),
    db.collection(COLLECTIONS.drivers).count().get(),
    db.collection(COLLECTIONS.buses).count().get(),
    db.collection(COLLECTIONS.trips).where('status', '==', 'active').count().get(),
    db.collection(COLLECTIONS.students).where('passStatus', '==', 'active').count().get(),
    db.collection(COLLECTIONS.attendance).where('date', '==', today).count().get(),
  ])

  return {
    totalStudents: students.data().count,
    totalDrivers: drivers.data().count,
    totalBuses: buses.data().count,
    activeTrips: activeTrips.data().count,
    activePasses: activePasses.data().count,
    todayAttendance: todayAttendance.data().count,
  }
}

export interface AttendanceTrendPoint {
  date: string
  count: number
}

export async function getAttendanceTrend(days = 7): Promise<AttendanceTrendPoint[]> {
  const db = getDb()
  const dates: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  const cutoff = dates[0]

  const snap = await db.collection(COLLECTIONS.attendance).where('date', '>=', cutoff).get()
  const counts = new Map<string, number>()
  for (const doc of snap.docs) {
    const { date } = doc.data() as AttendanceRecord
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  return dates.map((date) => ({ date, count: counts.get(date) ?? 0 }))
}

export interface BusUsagePoint {
  busNumber: string
  tripCount: number
}

export async function getBusUsage(): Promise<BusUsagePoint[]> {
  const db = getDb()
  const [tripsSnap, busesSnap] = await Promise.all([
    db.collection(COLLECTIONS.trips).get(),
    db.collection(COLLECTIONS.buses).get(),
  ])
  const busNumberById = new Map(busesSnap.docs.map((d) => [d.id, (d.data() as Bus).busNumber]))

  const counts = new Map<string, number>()
  for (const doc of tripsSnap.docs) {
    const { busId } = doc.data() as Trip
    counts.set(busId, (counts.get(busId) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([busId, tripCount]) => ({ busNumber: busNumberById.get(busId) ?? busId, tripCount }))
    .sort((a, b) => b.tripCount - a.tripCount)
    .slice(0, 10)
}

export interface DriverActivityPoint {
  driverName: string
  tripCount: number
}

export async function getDriverActivity(): Promise<DriverActivityPoint[]> {
  const db = getDb()
  const [tripsSnap, driversSnap] = await Promise.all([
    db.collection(COLLECTIONS.trips).get(),
    db.collection(COLLECTIONS.drivers).get(),
  ])
  const nameById = new Map(driversSnap.docs.map((d) => [d.id, (d.data() as Driver).name]))

  const counts = new Map<string, number>()
  for (const doc of tripsSnap.docs) {
    const { driverId } = doc.data() as Trip
    counts.set(driverId, (counts.get(driverId) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([driverId, tripCount]) => ({ driverName: nameById.get(driverId) ?? driverId, tripCount }))
    .sort((a, b) => b.tripCount - a.tripCount)
    .slice(0, 10)
}
