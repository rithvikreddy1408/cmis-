import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { authLimiter } from '../middleware/rateLimit.js'
import {
  register,
  me,
  registerSchema,
  registerFcmToken,
  unregisterFcmToken,
  fcmTokenSchema,
} from '../controllers/auth.controller.js'
import { ADMIN_ROLES } from '../types/role.js'

export const authRouter = Router()

authRouter.post(
  '/auth/register',
  authLimiter,
  verifyToken,
  requireRole(...ADMIN_ROLES),
  validateBody(registerSchema),
  register,
)

authRouter.get('/auth/me', verifyToken, me)

authRouter.post('/auth/fcm-token', verifyToken, validateBody(fcmTokenSchema), registerFcmToken)
authRouter.delete('/auth/fcm-token', verifyToken, validateBody(fcmTokenSchema), unregisterFcmToken)
