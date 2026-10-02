import type { Response } from 'express'
import { recordPing, getLatestGps, getAllGpsPositions } from '../services/gps.service.js'
import type { AuthedRequest } from '../middleware/auth.js'
import { getStudentByUid } from '../services/students.service.js'
import { getDriverByUid } from '../services/drivers.service.js'
import { HttpError } from '../middleware/errorHandler.js'
import { ADMIN_ROLES } from '../types/role.js'

export async function ping(req: AuthedRequest, res: Response) {
  res.json(await recordPing(req.user!.uid, req.body))
}

export async function get(req: AuthedRequest, res: Response) {
  const busId = req.params.busId as string
  if (req.user?.role === 'student') {
    const student = await getStudentByUid(req.user.uid)
    if (student.busAssigned !== busId) throw new HttpError(403, 'You can only track your assigned bus', 'FORBIDDEN')
  } else if (req.user?.role === 'driver') {
    const driver = await getDriverByUid(req.user.uid)
    if (driver.busAssigned !== busId) throw new HttpError(403, 'You can only track your assigned bus', 'FORBIDDEN')
  } else if (!req.user?.role || !ADMIN_ROLES.includes(req.user.role)) {
    throw new HttpError(403, 'Insufficient permissions', 'FORBIDDEN')
  }
  res.json(await getLatestGps(busId))
}

export async function all(_req: AuthedRequest, res: Response) {
  res.json(await getAllGpsPositions())
}
