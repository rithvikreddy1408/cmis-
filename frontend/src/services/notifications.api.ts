import { api } from './api'
import type { AppNotification } from '../types'

export interface BroadcastInput {
  title: string
  message: string
  target: 'all' | 'role' | 'student'
  role?: 'student' | 'driver'
  studentId?: string
}

export const notificationsApi = {
  list: () => api.get<AppNotification[]>('/notifications').then((r) => r.data),

  markRead: (id: string) => api.post(`/notifications/${id}/read`),

  broadcast: (input: BroadcastInput) =>
    api.post<AppNotification>('/notifications/broadcast', input).then((r) => r.data),
}
