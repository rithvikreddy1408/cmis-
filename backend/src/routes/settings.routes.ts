import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { settingsUpdateSchema } from '../schemas/settings.schema.js'
import * as controller from '../controllers/settings.controller.js'

export const settingsRouter = Router()

// Readable by any signed-in role — matched before the admin-only block below.
settingsRouter.get('/settings/service-calendar', verifyToken, controller.serviceCalendar)

settingsRouter.use('/settings', verifyToken, requireRole(...ADMIN_ROLES))
settingsRouter.get('/settings', controller.get)
settingsRouter.patch('/settings', validateBody(settingsUpdateSchema), controller.update)
