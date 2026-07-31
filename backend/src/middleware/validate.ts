import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'
import { HttpError } from './errorHandler.js'

interface WithParsedQuery extends Request {
  parsedQuery?: unknown
}

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      throw new HttpError(
        400,
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        'VALIDATION_ERROR',
      )
    }
    req.body = result.data
    next()
  }
}

// Query params always arrive as strings (or undefined). Parsing through the
// schema is what actually applies zod's .coerce.number() and .default(...) —
// reading req.query directly skips both, so absent/string values reach
// services untouched. Stored on req.parsedQuery rather than reassigning
// req.query to avoid depending on Express's query object staying writable.
export function validateQuery(schema: ZodType) {
  return (req: WithParsedQuery, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      throw new HttpError(
        400,
        result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        'VALIDATION_ERROR',
      )
    }
    req.parsedQuery = result.data
    next()
  }
}
