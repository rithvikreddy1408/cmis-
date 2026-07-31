import { z } from 'zod'

// Trip start uses the driver's own assigned bus — no body needed, but this
// keeps the endpoint consistent with validateBody's pattern for future fields.
export const tripStartSchema = z.object({})

export const emergencySchema = z.object({
  message: z.string().max(500).optional(),
})
