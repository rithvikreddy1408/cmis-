import { api } from './api'

export interface AppSettings {
  geofenceRadiusKm: number
  defaultPassDurationDays: number
}

export const settingsApi = {
  get: () => api.get<AppSettings>('/settings').then((r) => r.data),
  update: (data: Partial<AppSettings>) => api.patch<AppSettings>('/settings', data).then((r) => r.data),
}
