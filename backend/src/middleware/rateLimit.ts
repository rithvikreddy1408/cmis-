import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import type { Request } from 'express'
import type { DeviceRequest } from './deviceAuth.js'

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

// Keyed by deviceId (available after deviceAuth runs, so this must be
// mounted after it) rather than IP — a campus network puts many readers
// behind the same IP, and a single compromised/malfunctioning reader
// shouldn't be able to throttle every other one.
export const tapLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) =>
    (req as DeviceRequest).device?.deviceId ?? ipKeyGenerator(req.ip ?? 'unknown'),
})
