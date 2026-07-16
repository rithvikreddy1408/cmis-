import { Router } from 'express'
import { isFirebaseConfigured } from '../firebase/admin.js'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({
    service: 'cmis-backend',
    version: '0.1.0',
    status: 'ok',
    firebase: isFirebaseConfigured() ? 'configured' : 'not configured',
    time: new Date().toISOString(),
  })
})
