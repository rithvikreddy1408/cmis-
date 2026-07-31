import type { Response } from 'express'
import {
  getNotificationsForUser,
  markNotificationRead,
  broadcastNotification,
} from '../services/notifications.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function list(req: AuthedRequest, res: Response) {
  res.json(await getNotificationsForUser(req.user!.uid, req.user!.role))
}

export async function broadcast(req: AuthedRequest, res: Response) {
  res.status(201).json(await broadcastNotification(req.body))
}

export async function markRead(req: AuthedRequest, res: Response) {
  await markNotificationRead(req.params.id as string, req.user!.uid)
  res.status(204).end()
}
