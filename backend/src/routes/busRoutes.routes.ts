import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody, validateQuery } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { routeCreateSchema, routeUpdateSchema, routeQuerySchema } from '../schemas/route.schema.js'
import * as controller from '../controllers/routes.controller.js'

export const busRoutesRouter = Router()

// Single-route reads are assignment-checked for students/drivers and match
// before the admin-only block below.
busRoutesRouter.get('/routes/:id', verifyToken, controller.get)

busRoutesRouter.use('/routes', verifyToken, requireRole(...ADMIN_ROLES))

busRoutesRouter.get('/routes', validateQuery(routeQuerySchema), controller.list)
busRoutesRouter.post('/routes', validateBody(routeCreateSchema), controller.create)
busRoutesRouter.patch('/routes/:id', validateBody(routeUpdateSchema), controller.update)
busRoutesRouter.delete('/routes/:id', controller.remove)
