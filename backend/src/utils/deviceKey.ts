import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'

export function generateDeviceKey(): string {
  return randomBytes(24).toString('base64url')
}

export function hashDeviceKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

export function verifyDeviceKey(rawKey: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashDeviceKey(rawKey), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}
