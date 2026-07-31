import { api } from './api'

export interface OverviewStats {
  totalStudents: number
  totalDrivers: number
  totalBuses: number
  activeTrips: number
  activePasses: number
  todayAttendance: number
}

export interface AttendanceTrendPoint {
  date: string
  count: number
}

export interface BusUsagePoint {
  busNumber: string
  tripCount: number
}

export interface DriverActivityPoint {
  driverName: string
  tripCount: number
}

export const dashboardApi = {
  overview: () => api.get<OverviewStats>('/dashboard/overview').then((r) => r.data),
  attendanceTrend: (days = 7) =>
    api.get<AttendanceTrendPoint[]>('/dashboard/attendance-trend', { params: { days } }).then((r) => r.data),
  busUsage: () => api.get<BusUsagePoint[]>('/dashboard/bus-usage').then((r) => r.data),
  driverActivity: () => api.get<DriverActivityPoint[]>('/dashboard/driver-activity').then((r) => r.data),
}
