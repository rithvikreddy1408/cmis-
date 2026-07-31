import { getAuth, getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import type { Role } from '../types/role.js'

interface CreateUserInput {
  email: string
  password: string
  displayName: string
  role: Role
  linkedId?: string | null
}

export async function createUserWithRole(input: CreateUserInput) {
  const auth = getAuth()
  const db = getDb()

  let userRecord
  try {
    userRecord = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    })
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'auth/email-already-exists'
    ) {
      throw new HttpError(
        409,
        'A user with this email already exists',
        'EMAIL_EXISTS',
      )
    }
    throw err
  }

  await auth.setCustomUserClaims(userRecord.uid, { role: input.role })

  const profile = {
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    linkedId: input.linkedId ?? null,
    createdAt: new Date().toISOString(),
  }
  await db.collection(COLLECTIONS.users).doc(userRecord.uid).set(profile)

  return { uid: userRecord.uid, ...profile }
}

export async function getUserProfile(uid: string) {
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.users).doc(uid).get()
  if (!doc.exists) {
    throw new HttpError(404, 'User profile not found', 'PROFILE_NOT_FOUND')
  }
  return { uid, ...doc.data() }
}
