import 'dotenv/config'
import { createServer } from 'node:http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { healthRouter } from './routes/health.routes.js'
import { errorHandler } from './middleware/errorHandler.js'
import { initSocket } from './socket/index.js'

const PORT = Number(process.env.PORT) || 4000
const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())

const app = express()

app.use(helmet())
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '1mb' }))

app.use('/api/v1', healthRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})
app.use(errorHandler)

const httpServer = createServer(app)
initSocket(httpServer, CORS_ORIGIN)

httpServer.listen(PORT, () => {
  console.log(`CMIS backend listening on http://localhost:${PORT}`)
})
