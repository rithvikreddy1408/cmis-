export type Role = 'super_admin' | 'transport_admin' | 'driver' | 'student'

export interface Student {
  studentId: string
  rollNumber: string
  name: string
  branch: string
  year: number
  section: string
  phone: string
  email: string
  rfidUID: string | null
  busAssigned: string | null
  routeId: string | null
  passStatus: 'active' | 'expired' | 'revoked' | 'none'
  passExpiry: string | null
  createdAt: string
}

export interface Driver {
  driverId: string
  name: string
  phone: string
  email: string
  busAssigned: string | null
  routeAssigned: string | null
  licenseNumber: string
  status: 'active' | 'inactive' | 'on_trip'
  createdAt: string
}

export interface Bus {
  busId: string
  busNumber: string
  driverId: string | null
  routeId: string | null
  capacity: number
  currentOccupancy: number
  status: 'idle' | 'on_trip' | 'offline' | 'maintenance'
  lastUpdated: string
  createdAt: string
}

export interface RouteStop {
  name: string
  lat: number
  lng: number
  order: number
}

export interface LatLng {
  lat: number
  lng: number
}

export interface BusRoute {
  routeId: string
  routeName: string
  startPoint: string
  destination: string
  startLocation: LatLng | null
  destinationLocation: LatLng | null
  stops: RouteStop[]
  distance: number | null
  expectedTime: number | null
  polyline: string | null
  createdAt: string
}

export interface AttendanceRecord {
  attendanceId: string
  studentId: string
  busId: string
  tripId: string
  rfidUID: string
  boardingTime: string
  date: string
  boardingStop: string | null
}

export interface BusPass {
  passId: string
  studentId: string
  issuedDate: string
  expiryDate: string
  status: 'active' | 'expired' | 'revoked'
}

export interface Trip {
  tripId: string
  busId: string
  driverId: string
  routeId: string | null
  startTime: string
  endTime: string | null
  status: 'active' | 'completed'
  peakOccupancy: number
  distanceKm: number
}

export interface GpsPosition {
  busId: string
  latitude: number
  longitude: number
  speed: number
  heading: number
  updatedAt: string
  tripId: string | null
}

export interface AppNotification {
  notificationId: string
  title: string
  message: string
  recipientType: 'all' | 'admin' | 'role' | 'uid'
  recipientId: string | null
  type: string
  readBy: string[]
  createdAt: string
}
