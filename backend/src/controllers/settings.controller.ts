import type { Response } from 'express'
import { getSettings, updateSettings } from '../services/settings.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function get(_req: AuthedRequest, res: Response) {
  res.json(await getSettings())
}

export async function update(req: AuthedRequest, res: Response) {
  res.json(await updateSettings(req.body))
}

// Students and drivers need the non-service calendar to know where an
// untracked bus is expected to be parked, but have no business reading
// geofence radii or pass policy — so this exposes only the calendar rather
// than opening up the settings document.
export async function serviceCalendar(_req: AuthedRequest, res: Response) {
  const { holidayDates } = await getSettings()
  res.json({ holidayDates })
}
