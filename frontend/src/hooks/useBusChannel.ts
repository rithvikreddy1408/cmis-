import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSocket } from '../context/SocketContext'
import type { AttendanceRecord, Bus, GpsPosition } from '../types'

// Subscribes to a bus's live room and pushes every event straight into the
// TanStack Query cache — components just read the normal query keys
// (['gps', busId], ['bus', busId]) and get live updates for free, no
// polling needed once the socket is connected.
export function useBusChannel(busId: string | null | undefined) {
  const { socket, connected } = useSocket()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!socket || !connected || !busId) return

    socket.emit('subscribe:bus', busId)

    const onGpsUpdate = (position: GpsPosition) => {
      if (position.busId === busId) {
        queryClient.setQueryData(['gps', busId], position)
      }
    }
    const onOccupancyUpdate = (payload: { busId: string; current: number; capacity: number }) => {
      if (payload.busId === busId) {
        queryClient.setQueryData<Bus | undefined>(['bus', busId], (prev) =>
          prev ? { ...prev, currentOccupancy: payload.current } : prev,
        )
      }
    }
    const onTripChange = () => {
      queryClient.invalidateQueries({ queryKey: ['trips', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['bus', busId] })
    }
    const onBusOffline = (payload: { busId: string }) => {
      if (payload.busId === busId) {
        queryClient.setQueryData<Bus | undefined>(['bus', busId], (prev) =>
          prev ? { ...prev, status: 'offline' } : prev,
        )
      }
    }
    const onAttendanceNew = (record: AttendanceRecord) => {
      if (record.busId === busId) {
        queryClient.invalidateQueries({ queryKey: ['trip-boarding', record.tripId] })
      }
    }

    socket.on('gps:update', onGpsUpdate)
    socket.on('occupancy:update', onOccupancyUpdate)
    socket.on('trip:started', onTripChange)
    socket.on('trip:ended', onTripChange)
    socket.on('bus:offline', onBusOffline)
    socket.on('attendance:new', onAttendanceNew)

    return () => {
      socket.emit('unsubscribe:bus', busId)
      socket.off('gps:update', onGpsUpdate)
      socket.off('occupancy:update', onOccupancyUpdate)
      socket.off('trip:started', onTripChange)
      socket.off('trip:ended', onTripChange)
      socket.off('bus:offline', onBusOffline)
      socket.off('attendance:new', onAttendanceNew)
    }
  }, [socket, connected, busId, queryClient])
}
