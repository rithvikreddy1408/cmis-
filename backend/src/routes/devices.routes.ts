import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { provisionDeviceSchema } from '../schemas/rfid.schema.js'
import * as controller from '../controllers/rfid.controller.js'

export const devicesRouter = Router()

devicesRouter.use('/devices', verifyToken, requireRole(...ADMIN_ROLES))

devicesRouter.get('/devices', controller.devices)
devicesRouter.post('/devices', validateBody(provisionDeviceSchema), controller.provision)
devicesRouter.delete('/devices/:deviceId', controller.revoke)
