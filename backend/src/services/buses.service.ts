import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { matchesSearch, paginate, type PageResult } from '../utils/pagination.js'
import type { Bus, Driver, BusRoute } from '../types/entities.js'
import type { z } from 'zod'
import type { busCreateSchema, busQuerySchema, busUpdateSchema } from '../schemas/bus.schema.js'

type CreateInput = z.infer<typeof busCreateSchema>
type UpdateInput = z.infer<typeof busUpdateSchema>
type QueryInput = z.infer<typeof busQuerySchema>

async function assertUniqueBusNumber(busNumber: string, excludeId?: string) {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.buses).where('busNumber', '==', busNumber).limit(2).get()
  const conflict = snap.docs.find((d) => d.id !== excludeId)
  if (conflict) {
    throw new HttpError(409, 'A bus with this number already exists', 'DUPLICATE')
  }
}

export async function listBuses(query: QueryInput): Promise<PageResult<Bus>> {
  const db = getDb()
  let ref: FirebaseFirestore.Query = db.collection(COLLECTIONS.buses)
  if (query.status) ref = ref.where('status', '==', query.status)

  const snap = await ref.get()
  let buses = snap.docs.map((d) => d.data() as Bus)
  buses = buses.filter((b) => matchesSearch([b.busNumber], query.search))
  buses.sort((a, b) => a.busNumber.localeCompare(b.busNumber))

  return paginate(buses, query.page, query.pageSize)
}

export async function getBus(busId: string): Promise<Bus> {
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.buses).doc(busId).get()
  if (!doc.exists) throw new HttpError(404, 'Bus not found', 'NOT_FOUND')
  return doc.data() as Bus
}

export async function createBus(input: CreateInput): Promise<Bus> {
  const db = getDb()
  await assertUniqueBusNumber(input.busNumber)

  const ref = db.collection(COLLECTIONS.buses).doc()
  const now = new Date().toISOString()
  const bus: Bus = {
    busId: ref.id,
    busNumber: input.busNumber,
    capacity: input.capacity,
    status: input.status,
    driverId: null,
    routeId: null,
    currentOccupancy: 0,
    lastUpdated: now,
    createdAt: now,
  }
  await ref.set(bus)
  return bus
}

export async function updateBus(busId: string, input: UpdateInput): Promise<Bus> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.buses).doc(busId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Bus not found', 'NOT_FOUND')

  if (input.busNumber) await assertUniqueBusNumber(input.busNumber, busId)

  await ref.update({ ...input, lastUpdated: new Date().toISOString() })
  const updated = await ref.get()
  return updated.data() as Bus
}

export async function deleteBus(busId: string): Promise<void> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.buses).doc(busId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Bus not found', 'NOT_FOUND')
  const bus = doc.data() as Bus

  if (bus.driverId) {
    await db.collection(COLLECTIONS.drivers).doc(bus.driverId).update({ busAssigned: null, routeAssigned: null })
  }

  const studentsSnap = await db.collection(COLLECTIONS.students).where('busAssigned', '==', busId).get()
  if (!studentsSnap.empty) {
    const batch = db.batch()
    studentsSnap.docs.forEach((d) => batch.update(d.ref, { busAssigned: null, routeId: null }))
    await batch.commit()
  }

  await ref.delete()
}

export interface PublicBusResult {
  busId: string
  busNumber: string
  status: Bus['status']
  driverName: string | null
  routeName: string | null
  destination: string | null
}

// Student/driver-facing search — any authenticated role, deliberately
// narrower fields than the admin list (no capacity/occupancy internals).
export async function searchBusesPublic(query?: string): Promise<PublicBusResult[]> {
  const db = getDb()
  const [busSnap, driverSnap, routeSnap] = await Promise.all([
    db.collection(COLLECTIONS.buses).get(),
    db.collection(COLLECTIONS.drivers).get(),
    db.collection(COLLECTIONS.routes).get(),
  ])

  const driverNameById = new Map(driverSnap.docs.map((d) => [d.id, (d.data() as Driver).name]))
  const routeById = new Map(routeSnap.docs.map((d) => [d.id, d.data() as BusRoute]))

  const results: PublicBusResult[] = busSnap.docs.map((d) => {
    const bus = d.data() as Bus
    const route = bus.routeId ? routeById.get(bus.routeId) : undefined
    return {
      busId: bus.busId,
      busNumber: bus.busNumber,
      status: bus.status,
      driverName: bus.driverId ? (driverNameById.get(bus.driverId) ?? null) : null,
      routeName: route?.routeName ?? null,
      destination: route?.destination ?? null,
    }
  })

  return results.filter((r) =>
    matchesSearch([r.busNumber, r.driverName, r.routeName, r.destination], query),
  )
}
