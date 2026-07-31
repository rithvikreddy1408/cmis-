import { getDb } from '../firebase/admin.js'

const SETTINGS_DOC_PATH = 'settings/app'

export interface AppSettings {
  geofenceRadiusKm: number
  defaultPassDurationDays: number
}

const DEFAULTS: AppSettings = {
  geofenceRadiusKm: 0.2,
  defaultPassDurationDays: 180,
}

// Short-lived cache — settings are read on every GPS ping (via the geofence
// check), so a Firestore round trip per ping would be wasteful. 30s matches
// the caching precedent already used for the Maps proxy.
let cached: { value: AppSettings; expiresAt: number } | null = null
const CACHE_TTL_MS = 30_000

export async function getSettings(): Promise<AppSettings> {
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const db = getDb()
  const doc = await db.doc(SETTINGS_DOC_PATH).get()
  const value: AppSettings = doc.exists ? { ...DEFAULTS, ...(doc.data() as Partial<AppSettings>) } : DEFAULTS
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS }
  return value
}

export async function updateSettings(input: Partial<AppSettings>): Promise<AppSettings> {
  const db = getDb()
  const current = await getSettings()
  const next = { ...current, ...input }
  await db.doc(SETTINGS_DOC_PATH).set(next, { merge: true })
  cached = { value: next, expiresAt: Date.now() + CACHE_TTL_MS }
  return next
}
