export type PassStatus = 'active' | 'expired' | 'revoked' | 'none'
export type DriverStatus = 'active' | 'inactive' | 'on_trip'
export type BusStatus = 'idle' | 'on_trip' | 'offline' | 'maintenance'

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
  passStatus: PassStatus
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
  status: DriverStatus
  createdAt: string
}

export interface Bus {
  busId: string
  busNumber: string
  driverId: string | null
  routeId: string | null
  capacity: number
  currentOccupancy: number
  status: BusStatus
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

export type TripStatus = 'active' | 'completed'

export interface Trip {
  tripId: string
  busId: string
  driverId: string
  routeId: string | null
  startTime: string
  endTime: string | null
  status: TripStatus
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

export interface GpsHistoryPoint {
  latitude: number
  longitude: number
  speed: number
  heading: number
  recordedAt: string
}

export type RfidCardStatus = 'active' | 'lost' | 'deactivated'

export interface RfidCardHistoryEntry {
  event: 'assigned' | 'replaced' | 'deactivated' | 'lost'
  at: string
  note: string | null
}

export interface RfidCard {
  rfidUID: string
  studentId: string
  status: RfidCardStatus
  assignedAt: string
  history: RfidCardHistoryEntry[]
}

export interface Device {
  deviceId: string
  busId: string
  apiKeyHash: string
  lastSeen: string | null
  createdAt: string
}

export type BusPassStatus = 'active' | 'expired' | 'revoked'

export interface BusPass {
  passId: string
  studentId: string
  issuedDate: string
  expiryDate: string
  status: BusPassStatus
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

export type TapRejectReason =
  | 'UNKNOWN_CARD'
  | 'CARD_LOST'
  | 'CARD_DEACTIVATED'
  | 'PASS_INVALID'
  | 'WRONG_BUS'
  | 'NO_ACTIVE_TRIP'

export interface TapRejection {
  rejectionId: string
  deviceId: string
  busId: string
  rfidUID: string
  reason: TapRejectReason
  at: string
}

export type NotificationRecipientType = 'all' | 'admin' | 'role' | 'uid'

export interface Notification {
  notificationId: string
  title: string
  message: string
  recipientType: NotificationRecipientType
  recipientId: string | null
  type: string
  readBy: string[]
  createdAt: string
}
