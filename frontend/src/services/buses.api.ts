import { api } from './api'
import type { Bus } from '../types'
import type { PageResult } from '../types/pagination'

export interface BusListParams {
  search?: string
  page?: number
  pageSize?: number
}

export interface PublicBusResult {
  busId: string
  busNumber: string
  status: Bus['status']
  driverName: string | null
  routeName: string | null
  destination: string | null
}

export const busesApi = {
  get: (id: string) => api.get<Bus>(`/buses/${id}`).then((r) => r.data),

  search: (q?: string) =>
    api.get<PublicBusResult[]>('/buses/search', { params: q ? { q } : undefined }).then((r) => r.data),

  list: (params: BusListParams) =>
    api.get<PageResult<Bus>>('/buses', { params }).then((r) => r.data),

  create: (data: { busNumber: string; capacity: number; status?: string }) =>
    api.post<Bus>('/buses', data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Bus>(`/buses/${id}`, data).then((r) => r.data),

  remove: (id: string) => api.delete(`/buses/${id}`),

  assignDriver: (id: string, driverId: string | null) =>
    api.post<Bus>(`/buses/${id}/assign-driver`, { driverId }).then((r) => r.data),

  assignRoute: (id: string, routeId: string | null) =>
    api.post<Bus>(`/buses/${id}/assign-route`, { routeId }).then((r) => r.data),
}
