import type { Response } from 'express'
import {
  createRoute,
  deleteRoute,
  getRoute,
  listRoutes,
  updateRoute,
} from '../services/routes.service.js'
import type { AuthedRequest } from '../middleware/auth.js'
import { getStudentByUid } from '../services/students.service.js'
import { getDriverByUid } from '../services/drivers.service.js'
import { getBus } from '../services/buses.service.js'
import { HttpError } from '../middleware/errorHandler.js'
import { ADMIN_ROLES } from '../types/role.js'

export async function list(req: AuthedRequest, res: Response) {
  res.json(await listRoutes(req.parsedQuery as never))
}

export async function get(req: AuthedRequest, res: Response) {
  const route = await getRoute((req.params.id as string))
  const role = req.user?.role
  if (role === 'student') {
    const student = await getStudentByUid(req.user!.uid)
    const bus = student.busAssigned ? await getBus(student.busAssigned) : null
    if (!bus || bus.routeId !== route.routeId) throw new HttpError(403, 'You can only view your assigned route', 'FORBIDDEN')
  } else if (role === 'driver') {
    const driver = await getDriverByUid(req.user!.uid)
    const bus = driver.busAssigned ? await getBus(driver.busAssigned) : null
    if (!bus || bus.routeId !== route.routeId) throw new HttpError(403, 'You can only view your assigned route', 'FORBIDDEN')
  } else if (!role || !ADMIN_ROLES.includes(role)) {
    throw new HttpError(403, 'Insufficient permissions', 'FORBIDDEN')
  }
  res.json(route)
}

export async function create(req: AuthedRequest, res: Response) {
  res.status(201).json(await createRoute(req.body))
}

export async function update(req: AuthedRequest, res: Response) {
  res.json(await updateRoute((req.params.id as string), req.body))
}

export async function remove(req: AuthedRequest, res: Response) {
  await deleteRoute((req.params.id as string))
  res.status(204).end()
}
