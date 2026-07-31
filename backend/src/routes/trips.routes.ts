import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { tripStartSchema, emergencySchema } from '../schemas/trip.schema.js'
import * as controller from '../controllers/trips.controller.js'

export const tripsRouter = Router()

tripsRouter.use('/trips', verifyToken, requireRole('driver'))

tripsRouter.get('/trips/active', controller.active)
tripsRouter.get('/trips/history', controller.history)
tripsRouter.post('/trips/start', validateBody(tripStartSchema), controller.start)
tripsRouter.post('/trips/:id/end', controller.end)
tripsRouter.get('/trips/:id/attendance', controller.boardingFeed)
tripsRouter.post('/trips/emergency', validateBody(emergencySchema), controller.emergency)
