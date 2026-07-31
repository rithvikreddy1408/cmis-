import { api } from './api'

export interface AttendanceReportRow {
  date: string
  boardingTime: string
  studentName: string
  rollNumber: string
  busNumber: string
  boardingStop: string | null
}

export interface StudentReport {
  studentName: string
  rollNumber: string
  daysBoarded: number
  busActiveDays: number
  attendancePercent: number | null
  records: AttendanceReportRow[]
}

export interface BusReport {
  busNumber: string
  tripCount: number
  totalDistanceKm: number
  avgPeakOccupancy: number
}

export interface DriverReport {
  driverName: string
  tripCount: number
  totalDrivingHours: number
  totalDistanceKm: number
}

export interface DateRange {
  startDate: string
  endDate: string
}

export const reportsApi = {
  attendance: (range: DateRange) =>
    api.get<AttendanceReportRow[]>('/reports/attendance', { params: range }).then((r) => r.data),

  student: (studentId: string, range: DateRange) =>
    api.get<StudentReport>(`/reports/students/${studentId}`, { params: range }).then((r) => r.data),

  bus: (busId: string, range: DateRange) =>
    api.get<BusReport>(`/reports/buses/${busId}`, { params: range }).then((r) => r.data),

  driver: (driverId: string, range: DateRange) =>
    api.get<DriverReport>(`/reports/drivers/${driverId}`, { params: range }).then((r) => r.data),
}
