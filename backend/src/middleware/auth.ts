import type { NextFunction, Request, Response } from 'express'
import { getAuth } from '../firebase/admin.js'
import { HttpError } from './errorHandler.js'
import type { Role } from '../types/role.js'

export interface AuthedRequest extends Request {
  user?: {
    uid: string
    email: string | null
    role: Role | null
  }
  parsedQuery?: unknown
}

export async function verifyToken(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing bearer token', 'NO_TOKEN')
  }

  const idToken = header.slice('Bearer '.length)
  let decoded
  try {
    decoded = await getAuth().verifyIdToken(idToken)
  } catch {
    throw new HttpError(401, 'Invalid or expired token', 'BAD_TOKEN')
  }

  req.user = {
    uid: decoded.uid,
    email: decoded.email ?? null,
    role: (decoded.role as Role | undefined) ?? null,
  }
  next()
}
