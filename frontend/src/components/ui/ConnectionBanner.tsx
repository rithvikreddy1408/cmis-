import { AnimatePresence, motion } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useSocket } from '../../context/SocketContext'

// Live tracking's whole promise breaks silently the moment the socket
// drops — a bus on a moving vehicle with patchy campus wifi is exactly
// the case this exists for. Only fires after a real connection was lost,
// never on the normal first-connect right after login.
export default function ConnectionBanner() {
  const { connected, hasConnectedOnce } = useSocket()
  const show = hasConnectedOnce && !connected

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="mb-4 flex items-center gap-2 rounded-lg border border-amber-900 bg-amber-950/30 px-3 py-2 text-sm text-amber-400"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          Reconnecting — live updates are paused until the connection is back.
        </motion.div>
      )}
    </AnimatePresence>
  )
}
