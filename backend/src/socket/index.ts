import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { getAuth } from '../firebase/admin.js'
import type { Role } from '../types/role.js'

export let io: Server

interface SocketData {
  uid: string
  role: Role | null
}

export function initSocket(httpServer: HttpServer, corsOrigin: string[]) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin },
  })

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      next(new Error('unauthorized'))
      return
    }
    try {
      const decoded = await getAuth().verifyIdToken(token)
      ;(socket.data as SocketData) = {
        uid: decoded.uid,
        role: (decoded.role as Role | undefined) ?? null,
      }
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData
    socket.join(`user:${data.uid}`)
    if (data.role === 'super_admin' || data.role === 'transport_admin') {
      socket.join('admin')
    }

    socket.on('subscribe:bus', (busId: unknown) => {
      if (typeof busId === 'string' && busId.length > 0 && busId.length < 64) {
        socket.join(`bus:${busId}`)
      }
    })
    socket.on('unsubscribe:bus', (busId: unknown) => {
      if (typeof busId === 'string') socket.leave(`bus:${busId}`)
    })
  })

  return io
}
