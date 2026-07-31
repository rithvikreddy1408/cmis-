import { api } from './api'
import type { BusRoute, LatLng, RouteStop } from '../types'
import type { PageResult } from '../types/pagination'

export interface RouteListParams {
  search?: string
  page?: number
  pageSize?: number
}

export interface RouteSaveInput {
  routeName: string
  startPoint: string
  destination: string
  startLocation?: LatLng | null
  destinationLocation?: LatLng | null
  stops?: RouteStop[]
  distance?: number | null
  expectedTime?: number | null
  polyline?: string | null
}

export const routesApi = {
  list: (params: RouteListParams) =>
    api.get<PageResult<BusRoute>>('/routes', { params }).then((r) => r.data),

  get: (id: string) => api.get<BusRoute>(`/routes/${id}`).then((r) => r.data),

  create: (data: RouteSaveInput) => api.post<BusRoute>('/routes', data).then((r) => r.data),

  update: (id: string, data: RouteSaveInput) =>
    api.patch<BusRoute>(`/routes/${id}`, data).then((r) => r.data),

  remove: (id: string) => api.delete(`/routes/${id}`),
}
