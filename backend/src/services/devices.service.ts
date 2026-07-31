import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { generateDeviceKey, hashDeviceKey } from '../utils/deviceKey.js'
import type { Device } from '../types/entities.js'

export type PublicDevice = Omit<Device, 'apiKeyHash'>

function toPublicDevice(device: Device): PublicDevice {
  const { apiKeyHash: _apiKeyHash, ...publicDevice } = device
  return publicDevice
}

export async function provisionDevice(
  busId: string,
): Promise<{ device: PublicDevice; rawKey: string }> {
  const db = getDb()
  const busDoc = await db.collection(COLLECTIONS.buses).doc(busId).get()
  if (!busDoc.exists) throw new HttpError(404, 'Bus not found', 'BUS_NOT_FOUND')

  const ref = db.collection(COLLECTIONS.devices).doc()
  const rawKey = generateDeviceKey()
  const device: Device = {
    deviceId: ref.id,
    busId,
    apiKeyHash: hashDeviceKey(rawKey),
    lastSeen: null,
    createdAt: new Date().toISOString(),
  }
  await ref.set(device)
  // apiKeyHash never leaves the server — the admin UI has no use for even
  // the hash, and there's no reason to hand out credential material at all.
  return { device: toPublicDevice(device), rawKey }
}

export async function listDevices(): Promise<PublicDevice[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.devices).get()
  return snap.docs.map((d) => toPublicDevice(d.data() as Device))
}

export async function revokeDevice(deviceId: string): Promise<void> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.devices).doc(deviceId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Device not found', 'NOT_FOUND')
  await ref.delete()
}
