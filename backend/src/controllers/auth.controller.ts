import type { Response } from 'express'
import { z } from 'zod'
import { createUserWithRole, getUserProfile } from '../services/auth.service.js'
import { registerToken, unregisterToken } from '../services/push.service.js'
import type { AuthedRequest } from '../middleware/auth.js'
import { HttpError } from '../middleware/errorHandler.js'

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  role: z.literal('transport_admin'),
})

export const fcmTokenSchema = z.object({
  token: z.string().min(1),
})

export async function register(req: AuthedRequest, res: Response) {
  // Only the seeded super admin can create another administrator. In
  // particular, a transport admin must never be able to grant super-admin
  // claims through this generic account-creation endpoint.
  if (req.user?.role !== 'super_admin') {
    throw new HttpError(
      403,
      'Only a super admin can create transport admin accounts',
      'FORBIDDEN',
    )
  }
  const user = await createUserWithRole(req.body)
  res.status(201).json(user)
}

export async function me(req: AuthedRequest, res: Response) {
  const profile = await getUserProfile(req.user!.uid)
  res.json(profile)
}

export async function registerFcmToken(req: AuthedRequest, res: Response) {
  await registerToken(req.user!.uid, req.body.token)
  res.status(204).end()
}

export async function unregisterFcmToken(req: AuthedRequest, res: Response) {
  await unregisterToken(req.user!.uid, req.body.token)
  res.status(204).end()
}
