import { api } from './api'
import type { Trip } from '../types'

export interface TripBoardingEntry {
  studentName: string
  rollNumber: string
  boardingTime: string
  boardingStop: string | null
}

export const tripsApi = {
  active: () => api.get<Trip | null>('/trips/active').then((r) => r.data),
  start: () => api.post<Trip>('/trips/start', {}).then((r) => r.data),
  end: (tripId: string) => api.post<Trip>(`/trips/${tripId}/end`).then((r) => r.data),
  history: () => api.get<Trip[]>('/trips/history').then((r) => r.data),
  boardingFeed: (tripId: string) =>
    api.get<TripBoardingEntry[]>(`/trips/${tripId}/attendance`).then((r) => r.data),
  emergency: (message?: string) => api.post('/trips/emergency', { message }),
}
