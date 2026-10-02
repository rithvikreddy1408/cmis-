import type { Response } from 'express'
import {
  createBus,
  deleteBus,
  getBus,
  listBuses,
  updateBus,
  searchBusesPublic,
} from '../services/buses.service.js'
import { assignDriverToBus, assignRouteToBus } from '../services/assignment.service.js'
import type { AuthedRequest } from '../middleware/auth.js'
import { getStudentByUid } from '../services/students.service.js'
import { getDriverByUid } from '../services/drivers.service.js'
import { HttpError } from '../middleware/errorHandler.js'
import { ADMIN_ROLES } from '../types/role.js'

export async function list(req: AuthedRequest, res: Response) {
  res.json(await listBuses(req.parsedQuery as never))
}

export async function get(req: AuthedRequest, res: Response) {
  const bus = await getBus((req.params.id as string))
  const role = req.user?.role
  if (role === 'student') {
    const student = await getStudentByUid(req.user!.uid)
    if (student.busAssigned !== bus.busId) throw new HttpError(403, 'You can only view your assigned bus', 'FORBIDDEN')
  } else if (role === 'driver') {
    const driver = await getDriverByUid(req.user!.uid)
    if (driver.busAssigned !== bus.busId) throw new HttpError(403, 'You can only view your assigned bus', 'FORBIDDEN')
  } else if (!role || !ADMIN_ROLES.includes(role)) {
    throw new HttpError(403, 'Insufficient permissions', 'FORBIDDEN')
  }
  res.json(bus)
}

export async function search(req: AuthedRequest, res: Response) {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined
  const results = await searchBusesPublic(q)
  if (req.user?.role === 'super_admin' || req.user?.role === 'transport_admin') {
    res.json(results)
    return
  }
  if (req.user?.role === 'student') {
    const student = await getStudentByUid(req.user.uid)
    res.json(results.filter((bus) => bus.busId === student.busAssigned))
    return
  }
  if (req.user?.role === 'driver') {
    const driver = await getDriverByUid(req.user.uid)
    res.json(results.filter((bus) => bus.busId === driver.busAssigned))
    return
  }
  throw new HttpError(403, 'Insufficient permissions', 'FORBIDDEN')
}

export async function create(req: AuthedRequest, res: Response) {
  res.status(201).json(await createBus(req.body))
}

export async function update(req: AuthedRequest, res: Response) {
  res.json(await updateBus((req.params.id as string), req.body))
}

export async function remove(req: AuthedRequest, res: Response) {
  await deleteBus((req.params.id as string))
  res.status(204).end()
}

export async function assignDriver(req: AuthedRequest, res: Response) {
  const { bus } = await assignDriverToBus((req.params.id as string), req.body.driverId)
  res.json(bus)
}

export async function assignRoute(req: AuthedRequest, res: Response) {
  res.json(await assignRouteToBus((req.params.id as string), req.body.routeId))
}
