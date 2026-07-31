import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { settingsUpdateSchema } from '../schemas/settings.schema.js'
import * as controller from '../controllers/settings.controller.js'

export const settingsRouter = Router()

settingsRouter.use('/settings', verifyToken, requireRole(...ADMIN_ROLES))
settingsRouter.get('/settings', controller.get)
settingsRouter.patch('/settings', validateBody(settingsUpdateSchema), controller.update)
