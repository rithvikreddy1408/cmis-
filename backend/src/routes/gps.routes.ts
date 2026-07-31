import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { gpsPingSchema } from '../schemas/gps.schema.js'
import * as controller from '../controllers/gps.controller.js'

export const gpsRouter = Router()

gpsRouter.use('/gps', verifyToken)

gpsRouter.post('/gps/ping', requireRole('driver'), validateBody(gpsPingSchema), controller.ping)
gpsRouter.get('/gps', requireRole(...ADMIN_ROLES), controller.all)
gpsRouter.get('/gps/:busId', controller.get)
