import type { Response } from 'express'
import { z } from 'zod'
import { createUserWithRole, getUserProfile } from '../services/auth.service.js'
import { registerToken, unregisterToken } from '../services/push.service.js'
import { ROLES } from '../types/role.js'
import type { AuthedRequest } from '../middleware/auth.js'

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1),
  role: z.enum(ROLES as [string, ...string[]]),
  linkedId: z.string().nullable().optional(),
})

export const fcmTokenSchema = z.object({
  token: z.string().min(1),
})

export async function register(req: AuthedRequest, res: Response) {
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
