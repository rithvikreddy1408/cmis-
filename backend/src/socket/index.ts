import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'

export let io: Server

export function initSocket(httpServer: HttpServer, corsOrigin: string[]) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin },
  })

  // Phase 2 adds Firebase token verification in this handshake.
  io.on('connection', (socket) => {
    socket.on('subscribe:bus', (busId: string) => {
      if (typeof busId === 'string' && busId.length < 64) {
        socket.join(`bus:${busId}`)
      }
    })
    socket.on('unsubscribe:bus', (busId: string) => {
      socket.leave(`bus:${busId}`)
    })
  })

  return io
}
