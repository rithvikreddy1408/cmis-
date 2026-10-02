import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import * as Sentry from '@sentry/node'
import { healthRouter } from './routes/health.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { studentsRouter } from './routes/students.routes.js'
import { driversRouter } from './routes/drivers.routes.js'
import { busesRouter } from './routes/buses.routes.js'
import { busRoutesRouter } from './routes/busRoutes.routes.js'
import { mapsRouter } from './routes/maps.routes.js'
import { tripsRouter } from './routes/trips.routes.js'
import { gpsRouter } from './routes/gps.routes.js'
import { rfidRouter } from './routes/rfid.routes.js'
import { devicesRouter } from './routes/devices.routes.js'
import { passesRouter } from './routes/passes.routes.js'
import { notificationsRouter } from './routes/notifications.routes.js'
import { dashboardRouter } from './routes/dashboard.routes.js'
import { settingsRouter } from './routes/settings.routes.js'
import { reportsRouter } from './routes/reports.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp(): Express {
  const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())

  const app = express()

  // Render and Cloud Run both put exactly one reverse proxy in front of the
  // app, so req.ip is the proxy's address unless Express is told to read
  // X-Forwarded-For. That matters because the auth rate limiter keys on IP:
  // untrusted, every login in the whole deployment shares one key and the
  // 20-per-15-minutes budget locks out all users at once. One hop is also the
  // narrowest setting that works — trusting every hop would let a client
  // spoof the header and evade the limit entirely.
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }

  app.use(helmet())
  app.use(cors({ origin: corsOrigin }))
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/v1', healthRouter)
  app.use('/api/v1', authRouter)
  app.use('/api/v1', studentsRouter)
  app.use('/api/v1', driversRouter)
  app.use('/api/v1', busesRouter)
  app.use('/api/v1', busRoutesRouter)
  app.use('/api/v1', mapsRouter)
  app.use('/api/v1', tripsRouter)
  app.use('/api/v1', gpsRouter)
  app.use('/api/v1', rfidRouter)
  app.use('/api/v1', devicesRouter)
  app.use('/api/v1', passesRouter)
  app.use('/api/v1', notificationsRouter)
  app.use('/api/v1', dashboardRouter)
  app.use('/api/v1', settingsRouter)
  app.use('/api/v1', reportsRouter)

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app)
  }
  app.use(errorHandler)

  return app
}
