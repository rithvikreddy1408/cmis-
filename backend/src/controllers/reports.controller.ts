import type { Response } from 'express'
import {
  getAttendanceReport,
  getStudentReport,
  getBusReport,
  getDriverReport,
} from '../services/reports.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function attendance(req: AuthedRequest, res: Response) {
  const { startDate, endDate } = req.parsedQuery as { startDate: string; endDate: string }
  res.json(await getAttendanceReport(startDate, endDate))
}

export async function student(req: AuthedRequest, res: Response) {
  const { startDate, endDate } = req.parsedQuery as { startDate: string; endDate: string }
  res.json(await getStudentReport(req.params.id as string, startDate, endDate))
}

export async function bus(req: AuthedRequest, res: Response) {
  const { startDate, endDate } = req.parsedQuery as { startDate: string; endDate: string }
  res.json(await getBusReport(req.params.id as string, startDate, endDate))
}

export async function driver(req: AuthedRequest, res: Response) {
  const { startDate, endDate } = req.parsedQuery as { startDate: string; endDate: string }
  res.json(await getDriverReport(req.params.id as string, startDate, endDate))
}
