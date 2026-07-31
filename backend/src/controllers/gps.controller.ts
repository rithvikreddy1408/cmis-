import type { Response } from 'express'
import { recordPing, getLatestGps, getAllGpsPositions } from '../services/gps.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function ping(req: AuthedRequest, res: Response) {
  res.json(await recordPing(req.user!.uid, req.body))
}

export async function get(req: AuthedRequest, res: Response) {
  res.json(await getLatestGps(req.params.busId as string))
}

export async function all(_req: AuthedRequest, res: Response) {
  res.json(await getAllGpsPositions())
}
