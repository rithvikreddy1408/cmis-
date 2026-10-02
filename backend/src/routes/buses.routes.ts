import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody, validateQuery } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import {
  busCreateSchema,
  busUpdateSchema,
  busQuerySchema,
  assignDriverSchema,
  assignRouteSchema,
} from '../schemas/bus.schema.js'
import * as controller from '../controllers/buses.controller.js'

export const busesRouter = Router()

// Assignment-limited reads are registered before the admin gate below, and
// /buses/search before /buses/:id so the param route doesn't swallow it.
busesRouter.get('/buses/search', verifyToken, controller.search)
busesRouter.get('/buses/:id', verifyToken, controller.get)

busesRouter.use('/buses', verifyToken, requireRole(...ADMIN_ROLES))

busesRouter.get('/buses', validateQuery(busQuerySchema), controller.list)
busesRouter.post('/buses', validateBody(busCreateSchema), controller.create)
busesRouter.patch('/buses/:id', validateBody(busUpdateSchema), controller.update)
busesRouter.delete('/buses/:id', controller.remove)
busesRouter.post('/buses/:id/assign-driver', validateBody(assignDriverSchema), controller.assignDriver)
busesRouter.post('/buses/:id/assign-route', validateBody(assignRouteSchema), controller.assignRoute)
