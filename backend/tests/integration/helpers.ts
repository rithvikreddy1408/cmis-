import { getAuth, getDb } from '../../src/firebase/admin.js'
import type { Role } from '../../src/types/role.js'

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-cmis-test'

export async function resetEmulators() {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
  if (!firestoreHost || !authHost) {
    throw new Error('Emulator hosts not set — run tests via `npm run test:integration`.')
  }

  await fetch(
    `http://${firestoreHost}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
  await fetch(`http://${authHost}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  })
}

export async function createAuthedUser(opts: {
  email: string
  password: string
  role: Role
  linkedId?: string | null
}): Promise<string> {
  const auth = getAuth()
  const db = getDb()

  const userRecord = await auth.createUser({
    email: opts.email,
    password: opts.password,
    displayName: opts.email,
  })
  await auth.setCustomUserClaims(userRecord.uid, { role: opts.role })
  await db.collection('users').doc(userRecord.uid).set({
    email: opts.email,
    displayName: opts.email,
    role: opts.role,
    linkedId: opts.linkedId ?? null,
    createdAt: new Date().toISOString(),
  })
  return userRecord.uid
}

export async function signIn(email: string, password: string): Promise<string> {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST
  const res = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  if (!res.ok) {
    throw new Error(`Emulator sign-in failed: ${res.status} ${await res.text()}`)
  }
  const body = (await res.json()) as { idToken: string }
  return body.idToken
}
