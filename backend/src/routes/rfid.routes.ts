import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { deviceAuth } from '../middleware/deviceAuth.js'
import { tapLimiter } from '../middleware/rateLimit.js'
import { ADMIN_ROLES } from '../types/role.js'
import { tapSchema, assignCardSchema } from '../schemas/rfid.schema.js'
import * as controller from '../controllers/rfid.controller.js'

export const rfidRouter = Router()

// Device-authenticated, not Firebase-authenticated — RFID readers are hardware,
// not logged-in users. Rate limit keyed by deviceId, mounted after deviceAuth
// so it's available and so an invalid-key request never even reaches the
// limiter's counter.
rfidRouter.post('/rfid/tap', deviceAuth, tapLimiter, validateBody(tapSchema), controller.tap)

rfidRouter.get('/rfid/rejections', verifyToken, requireRole(...ADMIN_ROLES), controller.rejections)
rfidRouter.get(
  '/attendance/:busId/today',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  controller.attendanceToday,
)

rfidRouter.post(
  '/students/:studentId/rfid/assign',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  validateBody(assignCardSchema),
  controller.assign,
)
rfidRouter.post(
  '/students/:studentId/rfid/lost',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  controller.reportLost,
)
rfidRouter.post(
  '/students/:studentId/rfid/deactivate',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  controller.deactivate,
)
rfidRouter.get(
  '/students/:studentId/rfid/history',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  controller.history,
)
