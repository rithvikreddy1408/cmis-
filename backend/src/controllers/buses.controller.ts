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

export async function list(req: AuthedRequest, res: Response) {
  res.json(await listBuses(req.parsedQuery as never))
}

export async function get(req: AuthedRequest, res: Response) {
  res.json(await getBus((req.params.id as string)))
}

export async function search(req: AuthedRequest, res: Response) {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined
  res.json(await searchBusesPublic(q))
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
