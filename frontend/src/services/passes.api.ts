import { api } from './api'
import type { Student } from '../types'

export interface BusPass {
  passId: string
  studentId: string
  issuedDate: string
  expiryDate: string
  status: 'active' | 'expired' | 'revoked'
}

export const passesApi = {
  issue: (studentId: string, expiryDate: string) =>
    api.post<BusPass>(`/students/${studentId}/passes/issue`, { expiryDate }).then((r) => r.data),

  renew: (studentId: string, expiryDate: string) =>
    api.post<BusPass>(`/students/${studentId}/passes/renew`, { expiryDate }).then((r) => r.data),

  revoke: (studentId: string) => api.post(`/students/${studentId}/passes/revoke`),

  history: (studentId: string) =>
    api.get<BusPass[]>(`/students/${studentId}/passes/history`).then((r) => r.data),

  expiring: () => api.get<Student[]>('/passes/expiring').then((r) => r.data),
}
