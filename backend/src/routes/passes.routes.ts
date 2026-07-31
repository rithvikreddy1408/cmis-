import { Router } from 'express'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import { issuePassSchema } from '../schemas/pass.schema.js'
import * as controller from '../controllers/passes.controller.js'

export const passesRouter = Router()

passesRouter.get('/passes/expiring', verifyToken, requireRole(...ADMIN_ROLES), controller.expiring)

passesRouter.post(
  '/students/:studentId/passes/issue',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  validateBody(issuePassSchema),
  controller.issue,
)
passesRouter.post(
  '/students/:studentId/passes/renew',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  validateBody(issuePassSchema),
  controller.renew,
)
passesRouter.post(
  '/students/:studentId/passes/revoke',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  controller.revoke,
)
passesRouter.get(
  '/students/:studentId/passes/history',
  verifyToken,
  requireRole(...ADMIN_ROLES),
  controller.history,
)
