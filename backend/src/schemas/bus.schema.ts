import { z } from 'zod'

export const busCreateSchema = z.object({
  busNumber: z.string().min(1),
  capacity: z.coerce.number().int().min(1).max(200),
  status: z.enum(['idle', 'on_trip', 'offline', 'maintenance']).default('idle'),
})

export const busUpdateSchema = busCreateSchema.partial()

export const busQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['idle', 'on_trip', 'offline', 'maintenance']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
})

export const assignDriverSchema = z.object({
  driverId: z.string().min(1).nullable(),
})

export const assignRouteSchema = z.object({
  routeId: z.string().min(1).nullable(),
})
