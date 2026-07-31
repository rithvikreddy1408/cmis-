import type { NextFunction, Response } from 'express'
import { HttpError } from './errorHandler.js'
import type { AuthedRequest } from './auth.js'
import type { Role } from '../types/role.js'

export function requireRole(...allowed: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user?.role) {
      throw new HttpError(403, 'No role assigned to this account', 'NO_ROLE')
    }
    if (!allowed.includes(req.user.role)) {
      throw new HttpError(403, 'Insufficient permissions', 'FORBIDDEN')
    }
    next()
  }
}
