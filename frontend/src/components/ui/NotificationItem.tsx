import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { Bell, BellRing, Check } from 'lucide-react'

const SWIPE_THRESHOLD = -64

export default function NotificationItem({
  title,
  message,
  createdAt,
  isRead,
  type,
  onMarkRead,
}: {
  title: string
  message: string
  createdAt: string
  isRead: boolean
  type?: string
  onMarkRead: () => void
}) {
  const x = useMotionValue(0)
  const revealOpacity = useTransform(x, [SWIPE_THRESHOLD, 0], [1, 0])

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (!isRead && info.offset.x < SWIPE_THRESHOLD) {
      onMarkRead()
    }
    x.set(0)
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {!isRead && (
        <motion.div
          style={{ opacity: revealOpacity }}
          className="absolute inset-0 flex items-center justify-end bg-emerald-600 pr-5"
        >
          <Check className="h-4 w-4 text-white" />
        </motion.div>
      )}
      <motion.button
        drag={isRead ? false : 'x'}
        dragConstraints={{ left: SWIPE_THRESHOLD * 1.3, right: 0 }}
        dragElastic={0.15}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onClick={() => !isRead && onMarkRead()}
        className={`relative flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
          isRead
            ? 'border-slate-200 bg-slate-100/40'
            : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100'
        }`}
      >
        {isRead ? (
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
        ) : (
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${isRead ? 'text-slate-700' : 'text-slate-900'}`}>
              {title}
            </p>
            {type && (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                {type}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">{message}</p>
          <p className="mt-1 text-xs text-slate-600">{new Date(createdAt).toLocaleString()}</p>
        </div>
      </motion.button>
    </div>
  )
}
