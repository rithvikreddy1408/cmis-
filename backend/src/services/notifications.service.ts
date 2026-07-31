import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import { HttpError } from '../middleware/errorHandler.js'
import { emitNotificationNew, emitAdminNotification, emitBroadcastNotification } from '../socket/emitters.js'
import { sendPush, getTokensForUids, getTokensForAdmins, getTokensForRole, getAllTokens } from './push.service.js'
import type { Notification, NotificationRecipientType } from '../types/entities.js'
import type { Role } from '../types/role.js'

const ADMIN_ROLES: Role[] = ['super_admin', 'transport_admin']

interface CreateInput {
  title: string
  message: string
  recipientType: NotificationRecipientType
  recipientId?: string | null
  type: string
}

export async function createNotification(input: CreateInput): Promise<Notification> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.notifications).doc()
  const notification: Notification = {
    notificationId: ref.id,
    title: input.title,
    message: input.message,
    recipientType: input.recipientType,
    recipientId: input.recipientId ?? null,
    type: input.type,
    readBy: [],
    createdAt: new Date().toISOString(),
  }
  await ref.set(notification)

  if (input.recipientType === 'uid' && input.recipientId) {
    emitNotificationNew(input.recipientId, notification)
    getTokensForUids([input.recipientId])
      .then((refs) => sendPush(refs, input.title, input.message))
      .catch(() => {})
  } else if (input.recipientType === 'admin') {
    emitAdminNotification(notification)
    getTokensForAdmins()
      .then((refs) => sendPush(refs, input.title, input.message))
      .catch(() => {})
  } else if (input.recipientType === 'all') {
    emitBroadcastNotification(notification)
    getAllTokens()
      .then((refs) => sendPush(refs, input.title, input.message))
      .catch(() => {})
  } else if (input.recipientType === 'role' && input.recipientId) {
    getTokensForRole(input.recipientId as Role)
      .then((refs) => sendPush(refs, input.title, input.message))
      .catch(() => {})
  }

  return notification
}

export async function getNotificationsForUser(uid: string, role: Role | null): Promise<Notification[]> {
  const db = getDb()
  const col = db.collection(COLLECTIONS.notifications)

  // Single-field equality filters only — no orderBy alongside a where() on a
  // different field, which would require a composite index. Sort in memory
  // instead; notification volume per user is small enough this is cheap.
  const queries = [col.where('recipientType', '==', 'all').get()]

  if (role && ADMIN_ROLES.includes(role)) {
    queries.push(col.where('recipientType', '==', 'admin').get())
  }
  if (role) {
    queries.push(col.where('recipientType', '==', 'role').get())
  }
  queries.push(col.where('recipientType', '==', 'uid').get())

  const snaps = await Promise.all(queries)
  const all = snaps
    .flatMap((s) => s.docs.map((d) => d.data() as Notification))
    .filter((n) => n.recipientType !== 'role' || n.recipientId === role)
    .filter((n) => n.recipientType !== 'uid' || n.recipientId === uid)

  const deduped = [...new Map(all.map((n) => [n.notificationId, n])).values()]
  deduped.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return deduped.slice(0, 50)
}

interface BroadcastInput {
  title: string
  message: string
  target: 'all' | 'role' | 'student'
  role?: 'student' | 'driver'
  studentId?: string
}

export async function broadcastNotification(input: BroadcastInput): Promise<Notification> {
  if (input.target === 'role') {
    if (!input.role) throw new HttpError(400, 'role is required when target is "role"', 'VALIDATION_ERROR')
    return createNotification({
      title: input.title,
      message: input.message,
      recipientType: 'role',
      recipientId: input.role,
      type: 'admin_broadcast',
    })
  }

  if (input.target === 'student') {
    if (!input.studentId) {
      throw new HttpError(400, 'studentId is required when target is "student"', 'VALIDATION_ERROR')
    }
    const db = getDb()
    const userSnap = await db
      .collection(COLLECTIONS.users)
      .where('linkedId', '==', input.studentId)
      .where('role', '==', 'student')
      .limit(1)
      .get()
    if (userSnap.empty) throw new HttpError(404, 'Student account not found', 'NOT_FOUND')
    return createNotification({
      title: input.title,
      message: input.message,
      recipientType: 'uid',
      recipientId: userSnap.docs[0].id,
      type: 'admin_broadcast',
    })
  }

  return createNotification({
    title: input.title,
    message: input.message,
    recipientType: 'all',
    type: 'admin_broadcast',
  })
}

export async function markNotificationRead(notificationId: string, uid: string): Promise<void> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.notifications).doc(notificationId)
  const doc = await ref.get()
  if (!doc.exists) return
  const notification = doc.data() as Notification
  if (!notification.readBy.includes(uid)) {
    await ref.update({ readBy: [...notification.readBy, uid] })
  }
}
