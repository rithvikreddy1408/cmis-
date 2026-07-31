import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import type { Bus, Driver, Student } from '../types/entities.js'

export async function assignStudentToBus(studentId: string, busId: string | null): Promise<Student> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.students).doc(studentId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Student not found', 'NOT_FOUND')

  let routeId: string | null = null
  if (busId) {
    const busDoc = await db.collection(COLLECTIONS.buses).doc(busId).get()
    if (!busDoc.exists) throw new HttpError(404, 'Bus not found', 'BUS_NOT_FOUND')
    routeId = (busDoc.data() as Bus).routeId ?? null
  }

  await ref.update({ busAssigned: busId, routeId })
  const updated = await ref.get()
  return updated.data() as Student
}

export async function assignDriverToBus(
  busId: string,
  driverId: string | null,
): Promise<{ bus: Bus; driver: Driver | null }> {
  const db = getDb()
  const busRef = db.collection(COLLECTIONS.buses).doc(busId)
  const busDoc = await busRef.get()
  if (!busDoc.exists) throw new HttpError(404, 'Bus not found', 'BUS_NOT_FOUND')
  const bus = busDoc.data() as Bus

  if (driverId) {
    const driverRef = db.collection(COLLECTIONS.drivers).doc(driverId)
    const driverDoc = await driverRef.get()
    if (!driverDoc.exists) throw new HttpError(404, 'Driver not found', 'DRIVER_NOT_FOUND')
    const incomingDriver = driverDoc.data() as Driver

    // Unassign this driver from whatever bus they were previously on.
    if (incomingDriver.busAssigned && incomingDriver.busAssigned !== busId) {
      await db
        .collection(COLLECTIONS.buses)
        .doc(incomingDriver.busAssigned)
        .update({ driverId: null })
    }
    // Unassign whoever was previously driving this bus.
    if (bus.driverId && bus.driverId !== driverId) {
      await db
        .collection(COLLECTIONS.drivers)
        .doc(bus.driverId)
        .update({ busAssigned: null, routeAssigned: null })
    }

    await busRef.update({ driverId })
    await driverRef.update({ busAssigned: busId, routeAssigned: bus.routeId ?? null })

    const [updatedBus, updatedDriver] = await Promise.all([busRef.get(), driverRef.get()])
    return { bus: updatedBus.data() as Bus, driver: updatedDriver.data() as Driver }
  }

  // Unassigning: clear whoever currently drives this bus.
  if (bus.driverId) {
    await db
      .collection(COLLECTIONS.drivers)
      .doc(bus.driverId)
      .update({ busAssigned: null, routeAssigned: null })
  }
  await busRef.update({ driverId: null })
  const updatedBus = await busRef.get()
  return { bus: updatedBus.data() as Bus, driver: null }
}

export async function assignRouteToBus(busId: string, routeId: string | null): Promise<Bus> {
  const db = getDb()
  const busRef = db.collection(COLLECTIONS.buses).doc(busId)
  const busDoc = await busRef.get()
  if (!busDoc.exists) throw new HttpError(404, 'Bus not found', 'BUS_NOT_FOUND')
  const bus = busDoc.data() as Bus

  if (routeId) {
    const routeDoc = await db.collection(COLLECTIONS.routes).doc(routeId).get()
    if (!routeDoc.exists) throw new HttpError(404, 'Route not found', 'ROUTE_NOT_FOUND')
  }

  await busRef.update({ routeId })

  // Keep denormalized caches in sync: the driver's routeAssigned and every
  // currently-assigned student's routeId mirror the bus's route.
  if (bus.driverId) {
    await db.collection(COLLECTIONS.drivers).doc(bus.driverId).update({ routeAssigned: routeId })
  }
  const studentsSnap = await db.collection(COLLECTIONS.students).where('busAssigned', '==', busId).get()
  if (!studentsSnap.empty) {
    const batch = db.batch()
    studentsSnap.docs.forEach((d) => batch.update(d.ref, { routeId }))
    await batch.commit()
  }

  const updated = await busRef.get()
  return updated.data() as Bus
}
