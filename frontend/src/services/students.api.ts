import { api } from './api'
import type { AttendanceRecord, Student } from '../types'
import type { PageResult } from '../types/pagination'

export interface StudentListParams {
  search?: string
  page?: number
  pageSize?: number
}

export const studentsApi = {
  me: () => api.get<Student>('/students/me').then((r) => r.data),

  get: (id: string) => api.get<Student>(`/students/${id}`).then((r) => r.data),

  list: (params: StudentListParams) =>
    api.get<PageResult<Student>>('/students', { params }).then((r) => r.data),

  create: (data: {
    rollNumber: string
    name: string
    branch: string
    year: number
    section: string
    phone: string
    email: string
    rfidUID?: string | null
  }) =>
    api
      .post<{ student: Student; tempPassword: string }>('/students', data)
      .then((r) => r.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<Student>(`/students/${id}`, data).then((r) => r.data),

  remove: (id: string) => api.delete(`/students/${id}`),

  assignBus: (id: string, busId: string | null) =>
    api.post<Student>(`/students/${id}/assign-bus`, { busId }).then((r) => r.data),

  activatePass: (id: string, expiryDate: string) =>
    api.post<Student>(`/students/${id}/activate-pass`, { expiryDate }).then((r) => r.data),

  myAttendance: (month?: string) =>
    api
      .get<AttendanceRecord[]>('/students/me/attendance', { params: month ? { month } : undefined })
      .then((r) => r.data),

  requestPassRenewal: () => api.post('/students/me/passes/renew-request'),

  importExcel: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<{
        createdCount: number
        rejectedCount: number
        created: { row: number; rollNumber?: string; name?: string; email?: string; tempPassword?: string }[]
        rejected: { row: number; data: Record<string, unknown>; errors: string }[]
      }>('/students/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
}
