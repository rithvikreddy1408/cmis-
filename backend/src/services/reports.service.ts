import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import type { AttendanceRecord, Bus, Driver, Student, Trip } from '../types/entities.js'

export interface AttendanceReportRow {
  date: string
  boardingTime: string
  studentName: string
  rollNumber: string
  busNumber: string
  boardingStop: string | null
}

export async function getAttendanceReport(
  startDate: string,
  endDate: string,
): Promise<AttendanceReportRow[]> {
  const db = getDb()
  const snap = await db
    .collection(COLLECTIONS.attendance)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get()
  const records = snap.docs.map((d) => d.data() as AttendanceRecord)
  if (records.length === 0) return []

  const [studentsSnap, busesSnap] = await Promise.all([
    db.collection(COLLECTIONS.students).get(),
    db.collection(COLLECTIONS.buses).get(),
  ])
  const studentById = new Map(studentsSnap.docs.map((d) => [d.id, d.data() as Student]))
  const busNumberById = new Map(busesSnap.docs.map((d) => [d.id, (d.data() as Bus).busNumber]))

  return records
    .map((r) => {
      const student = studentById.get(r.studentId)
      return {
        date: r.date,
        boardingTime: r.boardingTime,
        studentName: student?.name ?? 'Unknown',
        rollNumber: student?.rollNumber ?? '—',
        busNumber: busNumberById.get(r.busId) ?? r.busId,
        boardingStop: r.boardingStop,
      }
    })
    .sort((a, b) => b.boardingTime.localeCompare(a.boardingTime))
}

export interface StudentReport {
  studentName: string
  rollNumber: string
  daysBoarded: number
  busActiveDays: number
  attendancePercent: number | null
  records: AttendanceReportRow[]
}

export async function getStudentReport(
  studentId: string,
  startDate: string,
  endDate: string,
): Promise<StudentReport> {
  const db = getDb()
  const studentDoc = await db.collection(COLLECTIONS.students).doc(studentId).get()
  if (!studentDoc.exists) throw new HttpError(404, 'Student not found', 'NOT_FOUND')
  const student = studentDoc.data() as Student

  const [attSnap, busNumberEntry] = await Promise.all([
    db.collection(COLLECTIONS.attendance).where('studentId', '==', studentId).get(),
    student.busAssigned
      ? db.collection(COLLECTIONS.buses).doc(student.busAssigned).get()
      : Promise.resolve(null),
  ])
  const bus = busNumberEntry?.exists ? (busNumberEntry.data() as Bus) : null

  const records = attSnap.docs
    .map((d) => d.data() as AttendanceRecord)
    .filter((r) => r.date >= startDate && r.date <= endDate)
    .map((r) => ({
      date: r.date,
      boardingTime: r.boardingTime,
      studentName: student.name,
      rollNumber: student.rollNumber,
      busNumber: bus?.busNumber ?? r.busId,
      boardingStop: r.boardingStop,
    }))
    .sort((a, b) => b.boardingTime.localeCompare(a.boardingTime))

  const daysBoarded = new Set(records.map((r) => r.date)).size

  // Denominator proxy: distinct days the student's bus actually ran a trip
  // in this window — there's no academic calendar in this system, so "days
  // the bus operated" is the honest stand-in for "days attendance was
  // possible." Null (not 0%) when the bus never ran, rather than a
  // misleading 0% that implies the student missed days that never existed.
  let busActiveDays = 0
  if (student.busAssigned) {
    const tripsSnap = await db
      .collection(COLLECTIONS.trips)
      .where('busId', '==', student.busAssigned)
      .get()
    const activeDates = new Set(
      tripsSnap.docs
        .map((d) => (d.data() as Trip).startTime.slice(0, 10))
        .filter((date) => date >= startDate && date <= endDate),
    )
    busActiveDays = activeDates.size
  }

  return {
    studentName: student.name,
    rollNumber: student.rollNumber,
    daysBoarded,
    busActiveDays,
    attendancePercent: busActiveDays > 0 ? Math.round((daysBoarded / busActiveDays) * 100) : null,
    records,
  }
}

export interface BusReport {
  busNumber: string
  tripCount: number
  totalDistanceKm: number
  avgPeakOccupancy: number
}

export async function getBusReport(busId: string, startDate: string, endDate: string): Promise<BusReport> {
  const db = getDb()
  const busDoc = await db.collection(COLLECTIONS.buses).doc(busId).get()
  if (!busDoc.exists) throw new HttpError(404, 'Bus not found', 'NOT_FOUND')
  const bus = busDoc.data() as Bus

  const tripsSnap = await db.collection(COLLECTIONS.trips).where('busId', '==', busId).get()
  const trips = tripsSnap.docs
    .map((d) => d.data() as Trip)
    .filter((t) => {
      const day = t.startTime.slice(0, 10)
      return day >= startDate && day <= endDate
    })

  const totalDistanceKm = Math.round(trips.reduce((sum, t) => sum + t.distanceKm, 0) * 10) / 10
  const avgPeakOccupancy = trips.length
    ? Math.round((trips.reduce((sum, t) => sum + t.peakOccupancy, 0) / trips.length) * 10) / 10
    : 0

  return { busNumber: bus.busNumber, tripCount: trips.length, totalDistanceKm, avgPeakOccupancy }
}

export interface DriverReport {
  driverName: string
  tripCount: number
  totalDrivingHours: number
  totalDistanceKm: number
}

export async function getDriverReport(
  driverId: string,
  startDate: string,
  endDate: string,
): Promise<DriverReport> {
  const db = getDb()
  const driverDoc = await db.collection(COLLECTIONS.drivers).doc(driverId).get()
  if (!driverDoc.exists) throw new HttpError(404, 'Driver not found', 'NOT_FOUND')
  const driver = driverDoc.data() as Driver

  const tripsSnap = await db.collection(COLLECTIONS.trips).where('driverId', '==', driverId).get()
  const trips = tripsSnap.docs
    .map((d) => d.data() as Trip)
    .filter((t) => {
      const day = t.startTime.slice(0, 10)
      return day >= startDate && day <= endDate
    })

  const totalMs = trips.reduce((sum, t) => {
    if (!t.endTime) return sum
    return sum + (new Date(t.endTime).getTime() - new Date(t.startTime).getTime())
  }, 0)
  const totalDistanceKm = Math.round(trips.reduce((sum, t) => sum + t.distanceKm, 0) * 10) / 10

  return {
    driverName: driver.name,
    tripCount: trips.length,
    totalDrivingHours: Math.round((totalMs / 3_600_000) * 10) / 10,
    totalDistanceKm,
  }
}
