import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateQuery } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { reportRangeSchema } from '../schemas/report.schema.js'
import * as controller from '../controllers/reports.controller.js'

export const reportsRouter = Router()

reportsRouter.use('/reports', verifyToken, requireRole(...ADMIN_ROLES))

reportsRouter.get('/reports/attendance', validateQuery(reportRangeSchema), controller.attendance)
reportsRouter.get('/reports/students/:id', validateQuery(reportRangeSchema), controller.student)
reportsRouter.get('/reports/buses/:id', validateQuery(reportRangeSchema), controller.bus)
reportsRouter.get('/reports/drivers/:id', validateQuery(reportRangeSchema), controller.driver)
