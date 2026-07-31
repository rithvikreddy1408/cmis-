import { z } from 'zod'

export const notificationCreateSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  recipientType: z.enum(['all', 'admin', 'role', 'uid']),
  recipientId: z.string().nullable().optional(),
  type: z.string().min(1).default('general'),
})

export const broadcastSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  target: z.enum(['all', 'role', 'student']),
  role: z.enum(['student', 'driver']).optional(),
  studentId: z.string().optional(),
})
