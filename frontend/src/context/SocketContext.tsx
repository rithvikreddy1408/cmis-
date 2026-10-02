import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { API_ORIGIN } from '../services/api'

interface SocketContextValue {
  socket: Socket | null
  connected: boolean
  // True once the socket has connected at least once — lets a
  // "reconnecting" banner distinguish "just logged in, connecting for the
  // first time" (normal, don't alarm anyone) from "was live, just dropped"
  // (a real problem worth surfacing, e.g. on a moving bus with patchy wifi).
  hasConnectedOnce: boolean
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  hasConnectedOnce: false,
})

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [connected, setConnected] = useState(false)
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const [, forceRender] = useState(0)

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect()
      socketRef.current = null
      setConnected(false)
      setHasConnectedOnce(false)
      return
    }

    let cancelled = false

    async function connect() {
      const token = await user!.getIdToken()
      if (cancelled) return

      // Same origin rule as the REST client: relative in dev (Vite proxies the
      // websocket), absolute backend origin once deployed.
      const socket = io(API_ORIGIN || '/', {
        path: '/socket.io',
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      })
      socket.on('connect', () => {
        setConnected(true)
        setHasConnectedOnce(true)
      })
      socket.on('disconnect', () => setConnected(false))
      socketRef.current = socket
      forceRender((n) => n + 1)
    }
    connect()

    return () => {
      cancelled = true
      socketRef.current?.disconnect()
      socketRef.current = null
    }
  }, [user])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, hasConnectedOnce }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
