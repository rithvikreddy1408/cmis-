import { z } from 'zod'

export const settingsUpdateSchema = z.object({
  geofenceRadiusKm: z.coerce.number().min(0.05).max(2).optional(),
  defaultPassDurationDays: z.coerce.number().int().min(1).max(730).optional(),
})
