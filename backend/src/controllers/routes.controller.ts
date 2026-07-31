import type { Response } from 'express'
import {
  createRoute,
  deleteRoute,
  getRoute,
  listRoutes,
  updateRoute,
} from '../services/routes.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function list(req: AuthedRequest, res: Response) {
  res.json(await listRoutes(req.parsedQuery as never))
}

export async function get(req: AuthedRequest, res: Response) {
  res.json(await getRoute((req.params.id as string)))
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
