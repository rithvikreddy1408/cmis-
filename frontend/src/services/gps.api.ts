import { api } from './api'
import type { GpsPosition } from '../types'

export const gpsApi = {
  ping: (data: { latitude: number; longitude: number; speed: number; heading: number }) =>
    api.post<GpsPosition>('/gps/ping', data).then((r) => r.data),

  get: (busId: string) => api.get<GpsPosition>(`/gps/${busId}`).then((r) => r.data),

  all: () => api.get<GpsPosition[]>('/gps').then((r) => r.data),
}
