import { z } from 'zod'

export const geocodeQuerySchema = z.object({
  address: z.string().min(1),
})

export const directionsQuerySchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  waypoints: z.string().optional(), // pipe-separated "lat,lng|lat,lng"
})

export const etaQuerySchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
})
