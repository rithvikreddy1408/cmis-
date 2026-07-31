import { api } from './api'

export interface Device {
  deviceId: string
  busId: string
  lastSeen: string | null
  createdAt: string
}

export const devicesApi = {
  list: () => api.get<Device[]>('/devices').then((r) => r.data),

  provision: (busId: string) =>
    api.post<{ device: Device; rawKey: string }>('/devices', { busId }).then((r) => r.data),

  revoke: (deviceId: string) => api.delete(`/devices/${deviceId}`),
}
