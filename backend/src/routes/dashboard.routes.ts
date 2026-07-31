import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { ADMIN_ROLES } from '../types/role.js'
import * as controller from '../controllers/dashboard.controller.js'

export const dashboardRouter = Router()

dashboardRouter.use('/dashboard', verifyToken, requireRole(...ADMIN_ROLES))

dashboardRouter.get('/dashboard/overview', controller.overview)
dashboardRouter.get('/dashboard/attendance-trend', controller.attendanceTrend)
dashboardRouter.get('/dashboard/bus-usage', controller.busUsage)
dashboardRouter.get('/dashboard/driver-activity', controller.driverActivity)
