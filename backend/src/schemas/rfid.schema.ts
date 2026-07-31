import { z } from 'zod'

export const tapSchema = z.object({
  rfidUID: z.string().min(1),
})

export const assignCardSchema = z.object({
  rfidUID: z.string().min(1),
})

export const cardActionSchema = z.object({
  reason: z.string().optional(),
})

export const provisionDeviceSchema = z.object({
  busId: z.string().min(1),
})
