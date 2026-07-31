import type { Response } from 'express'
import * as XLSX from 'xlsx'
import {
  activateStudentPass,
  createStudent,
  deleteStudent,
  listStudents,
  updateStudent,
  getStudent,
  getStudentByUid,
} from '../services/students.service.js'
import { assignStudentToBus } from '../services/assignment.service.js'
import { getAttendanceHistoryForStudent } from '../services/attendance.service.js'
import { requestPassRenewal } from '../services/passes.service.js'
import { studentCreateSchema } from '../schemas/student.schema.js'
import { HttpError } from '../middleware/errorHandler.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function list(req: AuthedRequest, res: Response) {
  res.json(await listStudents(req.parsedQuery as never))
}

export async function get(req: AuthedRequest, res: Response) {
  res.json(await getStudent((req.params.id as string)))
}

export async function me(req: AuthedRequest, res: Response) {
  res.json(await getStudentByUid(req.user!.uid))
}

export async function myAttendance(req: AuthedRequest, res: Response) {
  const student = await getStudentByUid(req.user!.uid)
  const month = typeof req.query.month === 'string' ? req.query.month : undefined
  res.json(await getAttendanceHistoryForStudent(student.studentId, month))
}

export async function requestPassRenewalHandler(req: AuthedRequest, res: Response) {
  const student = await getStudentByUid(req.user!.uid)
  await requestPassRenewal(student.studentId)
  res.status(204).end()
}

export async function create(req: AuthedRequest, res: Response) {
  const { student, tempPassword } = await createStudent(req.body)
  res.status(201).json({ student, tempPassword })
}

export async function update(req: AuthedRequest, res: Response) {
  res.json(await updateStudent((req.params.id as string), req.body))
}

export async function remove(req: AuthedRequest, res: Response) {
  await deleteStudent((req.params.id as string))
  res.status(204).end()
}

export async function assignBus(req: AuthedRequest, res: Response) {
  res.json(await assignStudentToBus((req.params.id as string), req.body.busId))
}

export async function activatePass(req: AuthedRequest, res: Response) {
  res.json(await activateStudentPass((req.params.id as string), req.body.expiryDate))
}

interface ImportRowResult {
  row: number
  rollNumber?: string
  name?: string
  email?: string
  tempPassword?: string
}

interface ImportRejection {
  row: number
  data: Record<string, unknown>
  errors: string
}

export async function importExcel(req: AuthedRequest, res: Response) {
  const file = (req as unknown as { file?: Express.Multer.File }).file
  if (!file) {
    throw new HttpError(400, 'No file uploaded (expected field "file")', 'NO_FILE')
  }

  const workbook = XLSX.read(file.buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  const created: ImportRowResult[] = []
  const rejected: ImportRejection[] = []

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2 // header is row 1
    const raw = rows[i]
    const candidate = {
      rollNumber: String(raw.rollNumber ?? '').trim(),
      name: String(raw.name ?? '').trim(),
      branch: String(raw.branch ?? '').trim(),
      year: raw.year,
      section: String(raw.section ?? '').trim(),
      phone: String(raw.phone ?? '').trim(),
      email: String(raw.email ?? '').trim(),
      rfidUID: raw.rfidUID ? String(raw.rfidUID).trim() : undefined,
    }

    const parsed = studentCreateSchema.safeParse(candidate)
    if (!parsed.success) {
      rejected.push({
        row: rowNumber,
        data: candidate,
        errors: parsed.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; '),
      })
      continue
    }

    try {
      const { student, tempPassword } = await createStudent(parsed.data)
      created.push({
        row: rowNumber,
        rollNumber: student.rollNumber,
        name: student.name,
        email: student.email,
        tempPassword,
      })
    } catch (err) {
      rejected.push({
        row: rowNumber,
        data: candidate,
        errors: err instanceof HttpError ? err.message : 'Unexpected error creating student',
      })
    }
  }

  res.json({ createdCount: created.length, rejectedCount: rejected.length, created, rejected })
}
