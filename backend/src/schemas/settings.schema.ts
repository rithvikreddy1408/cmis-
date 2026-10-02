import { z } from 'zod'

export const settingsUpdateSchema = z.object({
  geofenceRadiusKm: z.coerce.number().min(0.05).max(2).optional(),
  defaultPassDurationDays: z.coerce.number().int().min(1).max(730).optional(),
  holidayDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD'))
    .max(365)
    .optional(),
})
