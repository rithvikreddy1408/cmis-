import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { broadcastSchema } from '../schemas/notification.schema.js'
import * as controller from '../controllers/notifications.controller.js'

export const notificationsRouter = Router()

notificationsRouter.use('/notifications', verifyToken)
notificationsRouter.get('/notifications', controller.list)
notificationsRouter.post('/notifications/:id/read', controller.markRead)
notificationsRouter.post(
  '/notifications/broadcast',
  requireRole(...ADMIN_ROLES),
  validateBody(broadcastSchema),
  controller.broadcast,
)
