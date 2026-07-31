import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateQuery } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { geocodeQuerySchema, directionsQuerySchema, etaQuerySchema } from '../schemas/maps.schema.js'
import * as controller from '../controllers/maps.controller.js'

export const mapsRouter = Router()

mapsRouter.use('/maps', verifyToken, requireRole(...ADMIN_ROLES))

mapsRouter.get('/maps/geocode', validateQuery(geocodeQuerySchema), controller.geocode)
mapsRouter.get('/maps/directions', validateQuery(directionsQuerySchema), controller.directions)
mapsRouter.get('/maps/eta', validateQuery(etaQuerySchema), controller.eta)
