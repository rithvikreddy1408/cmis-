import { existsSync } from 'node:fs'
import { initializeApp, applicationDefault, cert, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth as getAdminAuth, type Auth } from 'firebase-admin/auth'

// Initialized lazily so the server can boot (health checks, local dev)
// before a service account key is configured.
let app: App | null = null

function isEmulatorMode(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
}

export function isFirebaseConfigured(): boolean {
  if (isEmulatorMode()) return true
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) return true
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS
  return Boolean(path && existsSync(path))
}

export function getFirebase(): App {
  if (!app) {
    if (!isFirebaseConfigured()) {
      throw new Error(
        'Firebase Admin is not configured. Set GOOGLE_APPLICATION_CREDENTIALS in backend/.env ' +
          'to the path of your service account JSON (local dev), or GOOGLE_APPLICATION_CREDENTIALS_JSON ' +
          'to the JSON content itself (hosts like Render/Cloud Run with no local filesystem secret).',
      )
    }
    if (isEmulatorMode()) {
      // Emulators don't check credentials — a bare projectId is enough, and
      // there's no service account JSON in CI/test environments.
      app = initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-cmis-test' })
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      app = initializeApp({ credential: cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)) })
    } else {
      app = initializeApp({ credential: applicationDefault() })
    }
  }
  return app
}

export function getDb(): Firestore {
  return getFirestore(getFirebase())
}

export function getAuth(): Auth {
  return getAdminAuth(getFirebase())
}
