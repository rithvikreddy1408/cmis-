import { api } from './api'

export interface AppSettings {
  geofenceRadiusKm: number
  defaultPassDurationDays: number
  /** Non-service dates as YYYY-MM-DD. Sundays are derived, not listed. */
  holidayDates: string[]
}

export const settingsApi = {
  get: () => api.get<AppSettings>('/settings').then((r) => r.data),
  update: (data: Partial<AppSettings>) =>
    api.patch<AppSettings>('/settings', data).then((r) => r.data),
  // Readable by students and drivers, unlike the full settings document.
  serviceCalendar: () =>
    api.get<{ holidayDates: string[] }>('/settings/service-calendar').then((r) => r.data),
}
