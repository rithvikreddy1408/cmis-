import { beforeEach, describe, expect, it } from 'vitest'
import { getDb } from '../../src/firebase/admin.js'
import { deleteStudent } from '../../src/services/students.service.js'
import { issuePass } from '../../src/services/passes.service.js'
import { resetEmulators, createAuthedUser } from './helpers.js'
import type { Student, RfidCard, BusPass } from '../../src/types/entities.js'

async function seedStudent() {
  const db = getDb()
  const studentId = 'student-1'
  const rfidUID = 'CARD-0001'

  const student: Student = {
    studentId,
    rollNumber: 'R1',
    name: 'Test Student',
    branch: 'CSE',
    year: 2,
    section: 'A',
    phone: '8888888888',
    email: 'student@test.local',
    rfidUID,
    busAssigned: null,
    routeId: null,
    passStatus: 'active',
    passExpiry: null,
    createdAt: new Date().toISOString(),
  }
  await db.collection('students').doc(studentId).set(student)

  const card: RfidCard = {
    rfidUID,
    studentId,
    status: 'active',
    assignedAt: new Date().toISOString(),
    history: [{ event: 'assigned', at: new Date().toISOString(), note: null }],
  }
  await db.collection('rfidCards').doc(rfidUID).set(card)

  const userUid = await createAuthedUser({
    email: 'student@test.local',
    password: 'password123',
    role: 'student',
    linkedId: studentId,
  })

  return { studentId, rfidUID, userUid }
}

describe('deleteStudent cascade', () => {
  beforeEach(async () => {
    await resetEmulators()
  })

  it('revokes any active bus pass and deactivates the rfid card, instead of orphaning them', async () => {
    const { studentId, rfidUID } = await seedStudent()
    await issuePass(studentId, '2030-01-01')

    await deleteStudent(studentId)

    const passSnap = await getDb()
      .collection('busPasses')
      .where('studentId', '==', studentId)
      .get()
    expect(passSnap.size).toBe(1)
    expect((passSnap.docs[0]!.data() as BusPass).status).toBe('revoked')

    const cardDoc = await getDb().collection('rfidCards').doc(rfidUID).get()
    expect(cardDoc.exists).toBe(true)
    expect((cardDoc.data() as RfidCard).status).toBe('deactivated')

    const studentDoc = await getDb().collection('students').doc(studentId).get()
    expect(studentDoc.exists).toBe(false)
  })

  it('deletes cleanly when the student has no pass or card history', async () => {
    const db = getDb()
    const studentId = 'student-bare'
    const student: Student = {
      studentId,
      rollNumber: 'R2',
      name: 'Bare Student',
      branch: 'CSE',
      year: 1,
      section: 'B',
      phone: '7777777777',
      email: 'bare@test.local',
      rfidUID: null,
      busAssigned: null,
      routeId: null,
      passStatus: 'none',
      passExpiry: null,
      createdAt: new Date().toISOString(),
    }
    await db.collection('students').doc(studentId).set(student)

    await expect(deleteStudent(studentId)).resolves.toBeUndefined()

    const studentDoc = await db.collection('students').doc(studentId).get()
    expect(studentDoc.exists).toBe(false)
  })
})
