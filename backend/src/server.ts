import './instrument.js'
import { createServer } from 'node:http'
import { createApp } from './app.js'
import { parseCorsOrigin } from './utils/corsOrigin.js'
import { initSocket } from './socket/index.js'
import { startGpsWatchdog } from './services/gps.service.js'
import { startPassExpiryJob } from './services/passes.service.js'

const PORT = Number(process.env.PORT) || 4000
const CORS_ORIGIN = parseCorsOrigin(process.env.CORS_ORIGIN)

const app = createApp()
const httpServer = createServer(app)
initSocket(httpServer, CORS_ORIGIN)

httpServer.listen(PORT, () => {
  console.log(`CMIS backend listening on http://localhost:${PORT}`)
})

startGpsWatchdog()
startPassExpiryJob()
