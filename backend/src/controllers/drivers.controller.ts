import type { Response } from 'express'
import {
  createDriver,
  deleteDriver,
  getDriver,
  getDriverByUid,
  listDrivers,
  updateDriver,
} from '../services/drivers.service.js'
import { getStudentByUid } from '../services/students.service.js'
import { getBus } from '../services/buses.service.js'
import { assignDriverToBus } from '../services/assignment.service.js'
import { HttpError } from '../middleware/errorHandler.js'
import { ADMIN_ROLES } from '../types/role.js'
import type { Role } from '../types/role.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function list(req: AuthedRequest, res: Response) {
  res.json(await listDrivers(req.parsedQuery as never))
}

export async function get(req: AuthedRequest, res: Response) {
  res.json(await getDriver((req.params.id as string)))
}

export async function me(req: AuthedRequest, res: Response) {
  res.json(await getDriverByUid(req.user!.uid))
}

// Name+phone only, but still gated by an actual relationship — without
// this check any authenticated account could harvest every driver's phone
// number by enumerating driverIds (reachable via any bus's driverId field,
// which is itself intentionally visible so students can track any bus).
export async function getPublic(req: AuthedRequest, res: Response) {
  const driverId = req.params.id as string
  const { uid, role } = req.user!

  const authorized = await isAuthorizedForDriver(driverId, uid, role)
  if (!authorized) {
    throw new HttpError(403, 'Not authorized to view this driver', 'FORBIDDEN')
  }

  const driver = await getDriver(driverId)
  res.json({ name: driver.name, phone: driver.phone })
}

async function isAuthorizedForDriver(
  driverId: string,
  uid: string,
  role: Role | null,
): Promise<boolean> {
  if (role && ADMIN_ROLES.includes(role)) return true

  if (role === 'driver') {
    const caller = await getDriverByUid(uid)
    return caller.driverId === driverId
  }

  if (role === 'student') {
    const student = await getStudentByUid(uid)
    if (!student.busAssigned) return false
    const bus = await getBus(student.busAssigned)
    return bus.driverId === driverId
  }

  return false
}

export async function create(req: AuthedRequest, res: Response) {
  const { driver, tempPassword } = await createDriver(req.body)
  res.status(201).json({ driver, tempPassword })
}

export async function update(req: AuthedRequest, res: Response) {
  res.json(await updateDriver((req.params.id as string), req.body))
}

export async function remove(req: AuthedRequest, res: Response) {
  await deleteDriver((req.params.id as string))
  res.status(204).end()
}

export async function assignBus(req: AuthedRequest, res: Response) {
  const busId = req.body.busId as string | null
  if (!busId) {
    // Unassigning from the driver side: look up their current bus first.
    const driver = await getDriver((req.params.id as string))
    if (driver.busAssigned) {
      await assignDriverToBus(driver.busAssigned, null)
    }
    res.json(await getDriver((req.params.id as string)))
    return
  }
  await assignDriverToBus(busId, (req.params.id as string))
  res.json(await getDriver((req.params.id as string)))
}
