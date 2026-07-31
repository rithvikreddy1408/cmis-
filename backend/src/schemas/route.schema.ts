import { z } from 'zod'

export const routeStopSchema = z.object({
  name: z.string().min(1),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  order: z.coerce.number().int().min(0),
})

const latLngSchema = z.object({ lat: z.coerce.number(), lng: z.coerce.number() })

export const routeCreateSchema = z.object({
  routeName: z.string().min(1),
  startPoint: z.string().min(1),
  destination: z.string().min(1),
  startLocation: latLngSchema.nullable().optional(),
  destinationLocation: latLngSchema.nullable().optional(),
  stops: z.array(routeStopSchema).default([]),
  distance: z.coerce.number().min(0).nullable().optional(),
  expectedTime: z.coerce.number().min(0).nullable().optional(),
  polyline: z.string().nullable().optional(),
})

export const routeUpdateSchema = routeCreateSchema.partial()

export const routeQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
})
