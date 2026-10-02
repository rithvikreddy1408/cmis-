import { z } from 'zod'

export const driverCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  licenseNumber: z.string().min(1),
  status: z.enum(['active', 'inactive', 'on_trip']).default('active'),
  // Optional: when the admin sets a password at creation the account uses it
  // and the admin can hand it over directly. Left blank, a random one is
  // generated and shown once — which is easy to lose, so this is the
  // recoverable path rather than the only one.
  password: z.string().min(6).max(128).optional(),
})

// email excluded — see studentUpdateSchema for why (linked Auth account,
// never touched by this endpoint).
export const driverUpdateSchema = driverCreateSchema
  .omit({ email: true, password: true })
  .partial()

export const driverQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['active', 'inactive', 'on_trip']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
})

export const assignBusToDriverSchema = z.object({
  busId: z.string().min(1).nullable(),
})
