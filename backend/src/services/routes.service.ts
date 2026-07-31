import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { matchesSearch, paginate, type PageResult } from '../utils/pagination.js'
import type { BusRoute } from '../types/entities.js'
import type { z } from 'zod'
import type { routeCreateSchema, routeQuerySchema, routeUpdateSchema } from '../schemas/route.schema.js'

type CreateInput = z.infer<typeof routeCreateSchema>
type UpdateInput = z.infer<typeof routeUpdateSchema>
type QueryInput = z.infer<typeof routeQuerySchema>

export async function listRoutes(query: QueryInput): Promise<PageResult<BusRoute>> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.routes).get()
  let routes = snap.docs.map((d) => d.data() as BusRoute)
  routes = routes.filter((r) =>
    matchesSearch([r.routeName, r.startPoint, r.destination], query.search),
  )
  routes.sort((a, b) => a.routeName.localeCompare(b.routeName))

  return paginate(routes, query.page, query.pageSize)
}

export async function getRoute(routeId: string): Promise<BusRoute> {
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.routes).doc(routeId).get()
  if (!doc.exists) throw new HttpError(404, 'Route not found', 'NOT_FOUND')
  return doc.data() as BusRoute
}

export async function createRoute(input: CreateInput): Promise<BusRoute> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.routes).doc()
  const route: BusRoute = {
    routeId: ref.id,
    routeName: input.routeName,
    startPoint: input.startPoint,
    destination: input.destination,
    startLocation: input.startLocation ?? null,
    destinationLocation: input.destinationLocation ?? null,
    stops: input.stops,
    distance: input.distance ?? null,
    expectedTime: input.expectedTime ?? null,
    polyline: input.polyline ?? null,
    createdAt: new Date().toISOString(),
  }
  await ref.set(route)
  return route
}

export async function updateRoute(routeId: string, input: UpdateInput): Promise<BusRoute> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.routes).doc(routeId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Route not found', 'NOT_FOUND')

  await ref.update({ ...input })
  const updated = await ref.get()
  return updated.data() as BusRoute
}

export async function deleteRoute(routeId: string): Promise<void> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.routes).doc(routeId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Route not found', 'NOT_FOUND')

  const busesSnap = await db.collection(COLLECTIONS.buses).where('routeId', '==', routeId).get()
  if (!busesSnap.empty) {
    throw new HttpError(
      409,
      `Cannot delete: ${busesSnap.size} bus(es) are still assigned to this route`,
      'ROUTE_IN_USE',
    )
  }

  await ref.delete()
}
