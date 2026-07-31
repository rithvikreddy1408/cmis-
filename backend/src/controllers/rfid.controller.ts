import type { Response } from 'express'
import { recordTap, getAttendanceForBusToday, getRecentRejections } from '../services/attendance.service.js'
import { assignCard, reportLostOrDeactivate, getCardHistory } from '../services/rfidCards.service.js'
import { provisionDevice, listDevices, revokeDevice } from '../services/devices.service.js'
import type { AuthedRequest } from '../middleware/auth.js'
import type { DeviceRequest } from '../middleware/deviceAuth.js'

export async function tap(req: DeviceRequest, res: Response) {
  const { rfidUID } = req.body
  const result = await recordTap(req.device!.deviceId, req.device!.busId, rfidUID)
  res.json(result)
}

export async function attendanceToday(req: AuthedRequest, res: Response) {
  res.json(await getAttendanceForBusToday(req.params.busId as string))
}

export async function rejections(_req: AuthedRequest, res: Response) {
  res.json(await getRecentRejections())
}

export async function assign(req: AuthedRequest, res: Response) {
  res.json(await assignCard(req.params.studentId as string, req.body.rfidUID))
}

export async function reportLost(req: AuthedRequest, res: Response) {
  await reportLostOrDeactivate(req.params.studentId as string, 'lost')
  res.status(204).end()
}

export async function deactivate(req: AuthedRequest, res: Response) {
  await reportLostOrDeactivate(req.params.studentId as string, 'deactivated')
  res.status(204).end()
}

export async function history(req: AuthedRequest, res: Response) {
  res.json(await getCardHistory(req.params.studentId as string))
}

export async function provision(req: AuthedRequest, res: Response) {
  const { device, rawKey } = await provisionDevice(req.body.busId)
  res.status(201).json({ device, rawKey })
}

export async function devices(_req: AuthedRequest, res: Response) {
  res.json(await listDevices())
}

export async function revoke(req: AuthedRequest, res: Response) {
  await revokeDevice(req.params.deviceId as string)
  res.status(204).end()
}
