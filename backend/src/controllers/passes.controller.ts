import type { Response } from 'express'
import { issuePass, renewPass, revokePass, getPassHistory, getExpiringPasses } from '../services/passes.service.js'
import type { AuthedRequest } from '../middleware/auth.js'

export async function issue(req: AuthedRequest, res: Response) {
  res.status(201).json(await issuePass(req.params.studentId as string, req.body.expiryDate))
}

export async function renew(req: AuthedRequest, res: Response) {
  res.status(201).json(await renewPass(req.params.studentId as string, req.body.expiryDate))
}

export async function revoke(req: AuthedRequest, res: Response) {
  await revokePass(req.params.studentId as string)
  res.status(204).end()
}

export async function history(req: AuthedRequest, res: Response) {
  res.json(await getPassHistory(req.params.studentId as string))
}

export async function expiring(_req: AuthedRequest, res: Response) {
  res.json(await getExpiringPasses())
}
