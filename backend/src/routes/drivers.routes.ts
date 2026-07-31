import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody, validateQuery } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import {
  driverCreateSchema,
  driverUpdateSchema,
  driverQuerySchema,
  assignBusToDriverSchema,
} from '../schemas/driver.schema.js'
import * as controller from '../controllers/drivers.controller.js'

export const driversRouter = Router()

// Self-service route first — matches and responds before the admin-only
// block below ever runs for this path.
driversRouter.get('/drivers/me', verifyToken, requireRole('driver'), controller.me)

// Public-ish read (any authenticated role — students need their assigned
// driver's name/phone), name+phone only, no license/status/internal fields.
driversRouter.get('/drivers/:id/public', verifyToken, controller.getPublic)

driversRouter.use('/drivers', verifyToken, requireRole(...ADMIN_ROLES))

driversRouter.get('/drivers', validateQuery(driverQuerySchema), controller.list)
driversRouter.get('/drivers/:id', controller.get)
driversRouter.post('/drivers', validateBody(driverCreateSchema), controller.create)
driversRouter.patch('/drivers/:id', validateBody(driverUpdateSchema), controller.update)
driversRouter.delete('/drivers/:id', controller.remove)
driversRouter.post(
  '/drivers/:id/assign-bus',
  validateBody(assignBusToDriverSchema),
  controller.assignBus,
)
