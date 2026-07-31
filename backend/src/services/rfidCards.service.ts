import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import type { RfidCard, RfidCardHistoryEntry, Student } from '../types/entities.js'

async function deactivateExistingCard(studentId: string, event: 'replaced' | 'lost' | 'deactivated', note: string | null) {
  const db = getDb()
  const studentDoc = await db.collection(COLLECTIONS.students).doc(studentId).get()
  const student = studentDoc.data() as Student | undefined
  if (!student?.rfidUID) return

  const cardRef = db.collection(COLLECTIONS.rfidCards).doc(student.rfidUID)
  const cardDoc = await cardRef.get()
  if (cardDoc.exists) {
    const card = cardDoc.data() as RfidCard
    const entry: RfidCardHistoryEntry = { event, at: new Date().toISOString(), note }
    await cardRef.update({
      status: event === 'replaced' ? 'deactivated' : event,
      history: [...card.history, entry],
    })
  }
}

export async function assignCard(studentId: string, rfidUID: string): Promise<RfidCard> {
  const db = getDb()
  const studentDoc = await db.collection(COLLECTIONS.students).doc(studentId).get()
  if (!studentDoc.exists) throw new HttpError(404, 'Student not found', 'STUDENT_NOT_FOUND')

  const existingCardDoc = await db.collection(COLLECTIONS.rfidCards).doc(rfidUID).get()
  if (existingCardDoc.exists && (existingCardDoc.data() as RfidCard).status === 'active') {
    throw new HttpError(409, 'This RFID card is already active on another student', 'CARD_IN_USE')
  }

  // If the student already has a different active card, deactivate it first.
  await deactivateExistingCard(studentId, 'replaced', `Replaced with ${rfidUID}`)

  const now = new Date().toISOString()
  const card: RfidCard = {
    rfidUID,
    studentId,
    status: 'active',
    assignedAt: now,
    history: [{ event: 'assigned', at: now, note: null }],
  }
  await db.collection(COLLECTIONS.rfidCards).doc(rfidUID).set(card)
  await db.collection(COLLECTIONS.students).doc(studentId).update({ rfidUID })

  return card
}

export async function reportLostOrDeactivate(
  studentId: string,
  event: 'lost' | 'deactivated',
): Promise<void> {
  const db = getDb()
  const studentDoc = await db.collection(COLLECTIONS.students).doc(studentId).get()
  if (!studentDoc.exists) throw new HttpError(404, 'Student not found', 'STUDENT_NOT_FOUND')

  await deactivateExistingCard(studentId, event, null)
  await db.collection(COLLECTIONS.students).doc(studentId).update({ rfidUID: null })
}

export async function getCardHistory(studentId: string): Promise<RfidCard[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.rfidCards).where('studentId', '==', studentId).get()
  return snap.docs
    .map((d) => d.data() as RfidCard)
    .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())
}
