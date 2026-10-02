import { z } from 'zod'

export const studentCreateSchema = z.object({
  rollNumber: z.string().min(1),
  name: z.string().min(1),
  branch: z.string().min(1),
  year: z.coerce.number().int().min(1).max(6),
  section: z.string().min(1),
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  rfidUID: z.string().min(1).nullable().optional(),
  // Optional: when the admin sets a password at creation the account uses it
  // and the admin can hand it over directly. Left blank, a random one is
  // generated and shown once — which is easy to lose, so this is the
  // recoverable path rather than the only one.
  password: z.string().min(6).max(128).optional(),
})

// email is excluded: it's the linked Firebase Auth account's identity, and
// this endpoint never touches Auth — allowing it here would silently desync
// the login email from the student record.
export const studentUpdateSchema = studentCreateSchema
  .omit({ email: true, password: true })
  .partial()

export const studentQuerySchema = z.object({
  search: z.string().optional(),
  branch: z.string().optional(),
  year: z.coerce.number().int().optional(),
  section: z.string().optional(),
  passStatus: z.enum(['active', 'expired', 'revoked', 'none']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
})

export const assignBusSchema = z.object({
  busId: z.string().min(1).nullable(),
})

export const activatePassSchema = z.object({
  expiryDate: z.string().min(1),
})
