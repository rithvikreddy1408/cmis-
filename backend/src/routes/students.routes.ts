import { Router } from 'express'
import multer from 'multer'
import { verifyToken } from '../middleware/auth.js'
import { requireRole } from '../middleware/requireRole.js'
import { validateBody, validateQuery } from '../middleware/validate.js'
import { ADMIN_ROLES } from '../types/role.js'
import {
  studentCreateSchema,
  studentUpdateSchema,
  studentQuerySchema,
  assignBusSchema,
  activatePassSchema,
} from '../schemas/student.schema.js'
import * as controller from '../controllers/students.controller.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

export const studentsRouter = Router()

// Self-service routes first (any student reading their own data) — match
// and respond before the admin-only block below ever runs for these paths.
studentsRouter.get('/students/me', verifyToken, requireRole('student'), controller.me)
studentsRouter.get(
  '/students/me/attendance',
  verifyToken,
  requireRole('student'),
  controller.myAttendance,
)
studentsRouter.post(
  '/students/me/passes/renew-request',
  verifyToken,
  requireRole('student'),
  controller.requestPassRenewalHandler,
)

studentsRouter.use('/students', verifyToken, requireRole(...ADMIN_ROLES))

studentsRouter.get('/students', validateQuery(studentQuerySchema), controller.list)
studentsRouter.get('/students/:id', controller.get)
studentsRouter.post('/students', validateBody(studentCreateSchema), controller.create)
studentsRouter.patch('/students/:id', validateBody(studentUpdateSchema), controller.update)
studentsRouter.delete('/students/:id', controller.remove)
studentsRouter.post(
  '/students/:id/assign-bus',
  validateBody(assignBusSchema),
  controller.assignBus,
)
studentsRouter.post(
  '/students/:id/activate-pass',
  validateBody(activatePassSchema),
  controller.activatePass,
)
studentsRouter.post('/students/import', upload.single('file'), controller.importExcel)
