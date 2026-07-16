import { existsSync } from 'node:fs'
import { initializeApp, applicationDefault, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth as getAdminAuth, type Auth } from 'firebase-admin/auth'

// Initialized lazily so the server can boot (health checks, local dev)
// before a service account key is configured.
let app: App | null = null

export function isFirebaseConfigured(): boolean {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS
  return Boolean(path && existsSync(path))
}

export function getFirebase(): App {
  if (!app) {
    if (!isFirebaseConfigured()) {
      throw new Error(
        'Firebase Admin is not configured. Set GOOGLE_APPLICATION_CREDENTIALS in backend/.env ' +
          'to the path of your service account JSON.',
      )
    }
    app = initializeApp({ credential: applicationDefault() })
  }
  return app
}

export function getDb(): Firestore {
  return getFirestore(getFirebase())
}

export function getAuth(): Auth {
  return getAdminAuth(getFirebase())
}
