import type { Response } from 'express'
import { getSettings, updateSettings } from '../services/settings.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function get(_req: AuthedRequest, res: Response) {
  res.json(await getSettings())
}

export async function update(req: AuthedRequest, res: Response) {
  res.json(await updateSettings(req.body))
}
