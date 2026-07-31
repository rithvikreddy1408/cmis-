import { getAuth, getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { generateTempPassword } from '../utils/password.js'
import { matchesSearch, paginate, type PageResult } from '../utils/pagination.js'
import { createUserWithRole } from './auth.service.js'
import type { Driver } from '../types/entities.js'
import type { z } from 'zod'
import type { driverCreateSchema, driverQuerySchema, driverUpdateSchema } from '../schemas/driver.schema.js'

type CreateInput = z.infer<typeof driverCreateSchema>
type UpdateInput = z.infer<typeof driverUpdateSchema>
type QueryInput = z.infer<typeof driverQuerySchema>

async function assertUniqueLicense(licenseNumber: string, excludeId?: string) {
  const db = getDb()
  const snap = await db
    .collection(COLLECTIONS.drivers)
    .where('licenseNumber', '==', licenseNumber)
    .limit(2)
    .get()
  const conflict = snap.docs.find((d) => d.id !== excludeId)
  if (conflict) {
    throw new HttpError(409, 'A driver with this license number already exists', 'DUPLICATE')
  }
}

export async function listDrivers(query: QueryInput): Promise<PageResult<Driver>> {
  const db = getDb()
  let ref: FirebaseFirestore.Query = db.collection(COLLECTIONS.drivers)
  if (query.status) ref = ref.where('status', '==', query.status)

  const snap = await ref.get()
  let drivers = snap.docs.map((d) => d.data() as Driver)
  drivers = drivers.filter((d) => matchesSearch([d.name, d.email, d.licenseNumber], query.search))
  drivers.sort((a, b) => a.name.localeCompare(b.name))

  return paginate(drivers, query.page, query.pageSize)
}

export async function getDriver(driverId: string): Promise<Driver> {
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.drivers).doc(driverId).get()
  if (!doc.exists) throw new HttpError(404, 'Driver not found', 'NOT_FOUND')
  return doc.data() as Driver
}

export async function createDriver(
  input: CreateInput,
): Promise<{ driver: Driver; tempPassword: string }> {
  const db = getDb()
  await assertUniqueLicense(input.licenseNumber)

  const ref = db.collection(COLLECTIONS.drivers).doc()
  const tempPassword = generateTempPassword()

  try {
    await createUserWithRole({
      email: input.email,
      password: tempPassword,
      displayName: input.name,
      role: 'driver',
      linkedId: ref.id,
    })
  } catch (err) {
    if (err instanceof HttpError && err.code === 'EMAIL_EXISTS') {
      throw new HttpError(409, 'A user with this email already exists', 'EMAIL_EXISTS')
    }
    throw err
  }

  const driver: Driver = {
    driverId: ref.id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    licenseNumber: input.licenseNumber,
    status: input.status,
    busAssigned: null,
    routeAssigned: null,
    createdAt: new Date().toISOString(),
  }
  await ref.set(driver)
  return { driver, tempPassword }
}

export async function updateDriver(driverId: string, input: UpdateInput): Promise<Driver> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.drivers).doc(driverId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Driver not found', 'NOT_FOUND')

  if (input.licenseNumber) await assertUniqueLicense(input.licenseNumber, driverId)

  await ref.update({ ...input })
  const updated = await ref.get()
  return updated.data() as Driver
}

export async function deleteDriver(driverId: string): Promise<void> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.drivers).doc(driverId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Driver not found', 'NOT_FOUND')

  const driver = doc.data() as Driver
  if (driver.busAssigned) {
    await db.collection(COLLECTIONS.buses).doc(driver.busAssigned).update({ driverId: null })
  }

  const userSnap = await db
    .collection(COLLECTIONS.users)
    .where('linkedId', '==', driverId)
    .where('role', '==', 'driver')
    .limit(1)
    .get()

  await ref.delete()

  if (!userSnap.empty) {
    const userDoc = userSnap.docs[0]
    await getAuth()
      .deleteUser(userDoc.id)
      .catch(() => {})
    await userDoc.ref.delete()
  }
}

// Resolves the driver record linked to a Firebase Auth uid — used by the
// trip/gps endpoints, which authenticate as a driver but operate on their
// own driverId/busAssigned rather than an :id route param.
export async function getDriverByUid(uid: string): Promise<Driver> {
  const db = getDb()
  const userDoc = await db.collection(COLLECTIONS.users).doc(uid).get()
  const profile = userDoc.data() as { role?: string; linkedId?: string | null } | undefined
  if (!userDoc.exists || profile?.role !== 'driver' || !profile.linkedId) {
    throw new HttpError(403, 'No driver profile linked to this account', 'NO_DRIVER_PROFILE')
  }

  const driverDoc = await db.collection(COLLECTIONS.drivers).doc(profile.linkedId).get()
  if (!driverDoc.exists) {
    throw new HttpError(404, 'Linked driver record not found', 'DRIVER_NOT_FOUND')
  }
  return driverDoc.data() as Driver
}
