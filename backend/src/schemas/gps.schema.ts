import { z } from 'zod'

export const gpsPingSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  speed: z.coerce.number().min(0).default(0),
  heading: z.coerce.number().min(0).max(360).default(0),
})
