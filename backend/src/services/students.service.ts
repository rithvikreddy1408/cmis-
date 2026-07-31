import { getAuth, getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { generateTempPassword } from '../utils/password.js'
import { matchesSearch, paginate, type PageResult } from '../utils/pagination.js'
import { createUserWithRole } from './auth.service.js'
import { revokePass } from './passes.service.js'
import { reportLostOrDeactivate } from './rfidCards.service.js'
import type { Student } from '../types/entities.js'
import type { z } from 'zod'
import type {
  studentCreateSchema,
  studentQuerySchema,
  studentUpdateSchema,
} from '../schemas/student.schema.js'

type CreateInput = z.infer<typeof studentCreateSchema>
type UpdateInput = z.infer<typeof studentUpdateSchema>
type QueryInput = z.infer<typeof studentQuerySchema>

async function assertUnique(field: 'rollNumber' | 'rfidUID', value: string, excludeId?: string) {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.students).where(field, '==', value).limit(2).get()
  const conflict = snap.docs.find((d) => d.id !== excludeId)
  if (conflict) {
    throw new HttpError(409, `A student with this ${field} already exists`, 'DUPLICATE')
  }
}

export async function listStudents(query: QueryInput): Promise<PageResult<Student>> {
  const db = getDb()
  let ref: FirebaseFirestore.Query = db.collection(COLLECTIONS.students)

  if (query.branch) ref = ref.where('branch', '==', query.branch)
  if (query.year) ref = ref.where('year', '==', query.year)
  if (query.section) ref = ref.where('section', '==', query.section)
  if (query.passStatus) ref = ref.where('passStatus', '==', query.passStatus)

  const snap = await ref.get()
  let students = snap.docs.map((d) => d.data() as Student)
  students = students.filter((s) => matchesSearch([s.name, s.rollNumber, s.email], query.search))
  students.sort((a, b) => a.name.localeCompare(b.name))

  return paginate(students, query.page, query.pageSize)
}

export async function getStudent(studentId: string): Promise<Student> {
  const db = getDb()
  const doc = await db.collection(COLLECTIONS.students).doc(studentId).get()
  if (!doc.exists) throw new HttpError(404, 'Student not found', 'NOT_FOUND')
  return doc.data() as Student
}

export async function createStudent(
  input: CreateInput,
): Promise<{ student: Student; tempPassword: string }> {
  const db = getDb()
  await assertUnique('rollNumber', input.rollNumber)
  if (input.rfidUID) await assertUnique('rfidUID', input.rfidUID)

  const ref = db.collection(COLLECTIONS.students).doc()
  const tempPassword = generateTempPassword()

  try {
    await createUserWithRole({
      email: input.email,
      password: tempPassword,
      displayName: input.name,
      role: 'student',
      linkedId: ref.id,
    })
  } catch (err) {
    if (err instanceof HttpError && err.code === 'EMAIL_EXISTS') {
      throw new HttpError(409, 'A user with this email already exists', 'EMAIL_EXISTS')
    }
    throw err
  }

  const student: Student = {
    studentId: ref.id,
    rollNumber: input.rollNumber,
    name: input.name,
    branch: input.branch,
    year: input.year,
    section: input.section,
    phone: input.phone,
    email: input.email,
    rfidUID: input.rfidUID ?? null,
    busAssigned: null,
    routeId: null,
    passStatus: 'none',
    passExpiry: null,
    createdAt: new Date().toISOString(),
  }
  await ref.set(student)
  return { student, tempPassword }
}

export async function updateStudent(studentId: string, input: UpdateInput): Promise<Student> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.students).doc(studentId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Student not found', 'NOT_FOUND')

  if (input.rollNumber) await assertUnique('rollNumber', input.rollNumber, studentId)
  if (input.rfidUID) await assertUnique('rfidUID', input.rfidUID, studentId)

  await ref.update({ ...input })
  const updated = await ref.get()
  return updated.data() as Student
}

export async function deleteStudent(studentId: string): Promise<void> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.students).doc(studentId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Student not found', 'NOT_FOUND')

  const userSnap = await db
    .collection(COLLECTIONS.users)
    .where('linkedId', '==', studentId)
    .where('role', '==', 'student')
    .limit(1)
    .get()

  // Both calls touch the student doc as part of their own logic (revokePass
  // sets passStatus, reportLostOrDeactivate clears rfidUID) — must run
  // before ref.delete(), not after, or they'd operate on a doc that's
  // already gone. Without this, every student deletion permanently
  // orphaned their busPasses/rfidCards records (still referencing the
  // deleted studentId forever) instead of retiring them the same way
  // revoking a pass or reporting a card lost already does elsewhere.
  await revokePass(studentId)
  await reportLostOrDeactivate(studentId, 'deactivated')

  await ref.delete()

  if (!userSnap.empty) {
    const userDoc = userSnap.docs[0]
    await getAuth()
      .deleteUser(userDoc.id)
      .catch(() => {})
    await userDoc.ref.delete()
  }
}

export async function activateStudentPass(studentId: string, expiryDate: string): Promise<Student> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.students).doc(studentId)
  const doc = await ref.get()
  if (!doc.exists) throw new HttpError(404, 'Student not found', 'NOT_FOUND')

  await ref.update({ passStatus: 'active', passExpiry: expiryDate })
  const updated = await ref.get()
  return updated.data() as Student
}

// Resolves the student record linked to a Firebase Auth uid — mirrors
// getDriverByUid, used by student-facing endpoints (own profile, tracking).
export async function getStudentByUid(uid: string): Promise<Student> {
  const db = getDb()
  const userDoc = await db.collection(COLLECTIONS.users).doc(uid).get()
  const profile = userDoc.data() as { role?: string; linkedId?: string | null } | undefined
  if (!userDoc.exists || profile?.role !== 'student' || !profile.linkedId) {
    throw new HttpError(403, 'No student profile linked to this account', 'NO_STUDENT_PROFILE')
  }

  const studentDoc = await db.collection(COLLECTIONS.students).doc(profile.linkedId).get()
  if (!studentDoc.exists) {
    throw new HttpError(404, 'Linked student record not found', 'STUDENT_NOT_FOUND')
  }
  return studentDoc.data() as Student
}
