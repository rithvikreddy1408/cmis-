import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { getAuth, getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL
  if (!email) {
    console.error('Set SEED_ADMIN_EMAIL in backend/.env before seeding.')
    process.exit(1)
  }

  const auth = getAuth()
  const db = getDb()

  const existing = await auth.getUserByEmail(email).catch(() => null)
  if (existing) {
    await auth.setCustomUserClaims(existing.uid, { role: 'super_admin' })
    console.log(`User ${email} already exists — role confirmed as super_admin.`)
    return
  }

  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString('base64url')

  const userRecord = await auth.createUser({
    email,
    password,
    displayName: 'Super Admin',
  })
  await auth.setCustomUserClaims(userRecord.uid, { role: 'super_admin' })

  await db.collection(COLLECTIONS.users).doc(userRecord.uid).set({
    email,
    displayName: 'Super Admin',
    role: 'super_admin',
    linkedId: null,
    createdAt: new Date().toISOString(),
  })

  console.log('Super admin created:')
  console.log(`  email:    ${email}`)
  console.log(`  password: ${password}`)
  console.log('Save this password now — it will not be shown again. Log in and consider rotating it.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
