import { io } from './index.js'
import type {
  AttendanceRecord,
  GpsPosition,
  Trip,
} from '../types/entities.js'

// io is unset until initSocket() runs (e.g. integration tests that hit
// routes without booting the socket layer) — guard so those calls no-op
// instead of throwing on an undefined server.
export function emitGpsUpdate(busId: string, position: GpsPosition) {
  io?.to(`bus:${busId}`).to('admin').emit('gps:update', position)
}

export function emitAttendanceNew(busId: string, record: AttendanceRecord) {
  io?.to(`bus:${busId}`).to('admin').emit('attendance:new', record)
}

export function emitOccupancyUpdate(busId: string, current: number, capacity: number) {
  io?.to(`bus:${busId}`).to('admin').emit('occupancy:update', { busId, current, capacity })
}

export function emitTripStarted(busId: string, trip: Trip) {
  io?.to(`bus:${busId}`).to('admin').emit('trip:started', trip)
}

export function emitTripEnded(busId: string, trip: Trip) {
  io?.to(`bus:${busId}`).to('admin').emit('trip:ended', trip)
}

export function emitBusOffline(busId: string) {
  io?.to(`bus:${busId}`).to('admin').emit('bus:offline', { busId })
}

export function emitNotificationNew(uid: string, notification: unknown) {
  io?.to(`user:${uid}`).emit('notification:new', notification)
}

export function emitAdminNotification(notification: unknown) {
  io?.to('admin').emit('notification:new', notification)
}

export function emitBroadcastNotification(notification: unknown) {
  io?.emit('notification:new', notification)
}

export function emitEmergencyAlert(busId: string, driverName: string) {
  io?.to('admin').emit('emergency:alert', { busId, driverName, at: new Date().toISOString() })
}
