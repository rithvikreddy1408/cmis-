import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { createNotification } from './notifications.service.js'
import type { BusPass, Student } from '../types/entities.js'

async function createPassRecord(studentId: string, expiryDate: string): Promise<BusPass> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.busPasses).doc()
  const pass: BusPass = {
    passId: ref.id,
    studentId,
    issuedDate: new Date().toISOString(),
    expiryDate,
    status: 'active',
  }
  await ref.set(pass)
  await db
    .collection(COLLECTIONS.students)
    .doc(studentId)
    .update({ passStatus: 'active', passExpiry: expiryDate })
  return pass
}

export async function issuePass(studentId: string, expiryDate: string): Promise<BusPass> {
  const db = getDb()
  const studentDoc = await db.collection(COLLECTIONS.students).doc(studentId).get()
  if (!studentDoc.exists) throw new HttpError(404, 'Student not found', 'STUDENT_NOT_FOUND')
  return createPassRecord(studentId, expiryDate)
}

export async function renewPass(studentId: string, expiryDate: string): Promise<BusPass> {
  const db = getDb()
  const studentDoc = await db.collection(COLLECTIONS.students).doc(studentId).get()
  if (!studentDoc.exists) throw new HttpError(404, 'Student not found', 'STUDENT_NOT_FOUND')
  return createPassRecord(studentId, expiryDate)
}

export async function revokePass(studentId: string): Promise<void> {
  const db = getDb()
  const snap = await db
    .collection(COLLECTIONS.busPasses)
    .where('studentId', '==', studentId)
    .where('status', '==', 'active')
    .get()

  const batch = db.batch()
  snap.docs.forEach((d) => batch.update(d.ref, { status: 'revoked' }))
  await batch.commit()

  await db.collection(COLLECTIONS.students).doc(studentId).update({ passStatus: 'revoked' })
}

export async function getPassHistory(studentId: string): Promise<BusPass[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.busPasses).where('studentId', '==', studentId).get()
  return snap.docs
    .map((d) => d.data() as BusPass)
    .sort((a, b) => new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime())
}

export async function getExpiringPasses(daysAhead = 7): Promise<Student[]> {
  const db = getDb()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + daysAhead)

  const snap = await db.collection(COLLECTIONS.students).where('passStatus', '==', 'active').get()
  return snap.docs
    .map((d) => d.data() as Student)
    .filter((s) => s.passExpiry && new Date(s.passExpiry) <= cutoff)
    .sort((a, b) => new Date(a.passExpiry!).getTime() - new Date(b.passExpiry!).getTime())
}

// Flips passStatus 'active' -> 'expired' once expiryDate has passed. Run on a
// timer (see startPassExpiryJob) rather than needing external cron infra.
export async function runPassExpiryCheck(): Promise<number> {
  const db = getDb()
  const now = new Date()
  const snap = await db.collection(COLLECTIONS.students).where('passStatus', '==', 'active').get()

  const expired = snap.docs.filter((d) => {
    const s = d.data() as Student
    return s.passExpiry && new Date(s.passExpiry) < now
  })
  if (expired.length === 0) return 0

  const batch = db.batch()
  expired.forEach((d) => batch.update(d.ref, { passStatus: 'expired' }))
  await batch.commit()

  const passBatch = db.batch()
  for (const d of expired) {
    const student = d.data() as Student
    const passSnap = await db
      .collection(COLLECTIONS.busPasses)
      .where('studentId', '==', student.studentId)
      .where('status', '==', 'active')
      .get()
    passSnap.docs.forEach((p) => passBatch.update(p.ref, { status: 'expired' }))
  }
  await passBatch.commit()

  return expired.length
}

export function startPassExpiryJob(intervalMs = 60 * 60 * 1000) {
  return setInterval(() => {
    runPassExpiryCheck().catch((err) => console.error('[pass-expiry] error:', err))
  }, intervalMs)
}

export async function requestPassRenewal(studentId: string): Promise<void> {
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.students).doc(studentId).get()
  if (!doc.exists) throw new HttpError(404, 'Student not found', 'NOT_FOUND')
  const student = doc.data() as Student

  await createNotification({
    title: 'Bus pass renewal requested',
    message: `${student.name} (${student.rollNumber}) requested a bus pass renewal.`,
    recipientType: 'admin',
    type: 'pass_renewal_request',
  })
}
