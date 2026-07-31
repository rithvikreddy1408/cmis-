import { api } from './api'

export interface RfidCard {
  rfidUID: string
  studentId: string
  status: 'active' | 'lost' | 'deactivated'
  assignedAt: string
  history: { event: string; at: string; note: string | null }[]
}

export interface TapRejection {
  rejectionId: string
  deviceId: string
  busId: string
  rfidUID: string
  reason: string
  at: string
}

export const rfidApi = {
  assign: (studentId: string, rfidUID: string) =>
    api.post<RfidCard>(`/students/${studentId}/rfid/assign`, { rfidUID }).then((r) => r.data),

  reportLost: (studentId: string) => api.post(`/students/${studentId}/rfid/lost`),
  deactivate: (studentId: string) => api.post(`/students/${studentId}/rfid/deactivate`),

  history: (studentId: string) =>
    api.get<RfidCard[]>(`/students/${studentId}/rfid/history`).then((r) => r.data),

  rejections: () => api.get<TapRejection[]>('/rfid/rejections').then((r) => r.data),
}
