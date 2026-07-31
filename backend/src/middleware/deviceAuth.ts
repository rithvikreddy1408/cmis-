import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { verifyDeviceKey } from '../utils/deviceKey.js'
import { HttpError } from './errorHandler.js'
import type { Device } from '../types/entities.js'

export interface DeviceRequest extends Request {
  device?: { deviceId: string; busId: string }
}

export async function deviceAuth(req: DeviceRequest, _res: Response, next: NextFunction) {
  const deviceId = req.header('x-device-id')
  const deviceKey = req.header('x-device-key')
  if (!deviceId || !deviceKey) {
    throw new HttpError(401, 'Missing device credentials', 'NO_DEVICE_AUTH')
  }

  const db = getDb()
  const doc = await db.collection(COLLECTIONS.devices).doc(deviceId).get()
  if (!doc.exists) {
    throw new HttpError(401, 'Unknown device', 'UNKNOWN_DEVICE')
  }
  const device = doc.data() as Device

  if (!verifyDeviceKey(deviceKey, device.apiKeyHash)) {
    throw new HttpError(401, 'Invalid device key', 'BAD_DEVICE_KEY')
  }

  req.device = { deviceId: device.deviceId, busId: device.busId }
  doc.ref.update({ lastSeen: new Date().toISOString() }).catch(() => {})
  next()
}
