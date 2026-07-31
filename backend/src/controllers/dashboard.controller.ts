import type { Response } from 'express'
import {
  getOverviewStats,
  getAttendanceTrend,
  getBusUsage,
  getDriverActivity,
} from '../services/dashboard.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function overview(_req: AuthedRequest, res: Response) {
  res.json(await getOverviewStats())
}

export async function attendanceTrend(req: AuthedRequest, res: Response) {
  const days = req.query.days ? Number(req.query.days) : undefined
  res.json(await getAttendanceTrend(days))
}

export async function busUsage(_req: AuthedRequest, res: Response) {
  res.json(await getBusUsage())
}

export async function driverActivity(_req: AuthedRequest, res: Response) {
  res.json(await getDriverActivity())
}
