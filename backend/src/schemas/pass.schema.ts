import { z } from 'zod'

export const issuePassSchema = z.object({
  expiryDate: z.string().min(1),
})
