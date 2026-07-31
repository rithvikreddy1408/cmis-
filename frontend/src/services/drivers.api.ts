import { api } from './api'
import type { Driver } from '../types'
import type { PageResult } from '../types/pagination'

export interface DriverListParams {
  search?: string
  page?: number
  pageSize?: number
}

export const driversApi = {
  me: () => api.get<Driver>('/drivers/me').then((r) => r.data),

  getPublic: (id: string) =>
    api.get<{ name: string; phone: string }>(`/drivers/${id}/public`).then((r) => r.data),

  list: (params: DriverListParams) =>
    api.get<PageResult<Driver>>('/drivers', { params }).then((r) => r.data),

  create: (data: {
    name: string
    phone: string
    email: string
    licenseNumber: string
    status?: string
  }) => api.post<{ driver: Driver; tempPassword: string }>('/drivers', data).then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Driver>(`/drivers/${id}`, data).then((r) => r.data),

  remove: (id: string) => api.delete(`/drivers/${id}`),

  assignBus: (id: string, busId: string | null) =>
    api.post<Driver>(`/drivers/${id}/assign-bus`, { busId }).then((r) => r.data),
}
