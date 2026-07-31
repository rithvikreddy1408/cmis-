import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Loader2, ArrowDown } from 'lucide-react'

const THRESHOLD = 64
const MAX_PULL = 90

// Wraps a page's content — no scroll container of its own, since the real
// scrollable ancestor is AppShell's <main>. Only activates when that
// ancestor is already at scrollTop 0, so it never fights a normal scroll.
export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>
  children: ReactNode
}) {
  const [refreshing, setRefreshing] = useState(false)
  const pull = useMotionValue(0)
  const startY = useRef<number | null>(null)
  const rotate = useTransform(pull, [0, THRESHOLD], [0, 180])
  const indicatorOpacity = useTransform(pull, [0, 20], [0, 1])

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (refreshing) return
    const scrollParent = e.currentTarget.closest('main')
    startY.current = !scrollParent || scrollParent.scrollTop <= 0 ? e.touches[0].clientY : null
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (startY.current === null || refreshing) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) {
      pull.set(Math.min(delta * 0.5, MAX_PULL))
    }
  }

  async function handleTouchEnd() {
    if (startY.current === null) return
    const distance = pull.get()
    startY.current = null
    if (distance >= THRESHOLD) {
      setRefreshing(true)
      animate(pull, 40, { duration: 0.15 })
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        animate(pull, 0, { duration: 0.2 })
      }
    } else {
      animate(pull, 0, { duration: 0.2 })
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      <motion.div
        style={{ opacity: indicatorOpacity }}
        className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 md:hidden"
      >
        {refreshing ? (
          <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
        ) : (
          <motion.div style={{ rotate }}>
            <ArrowDown className="h-5 w-5 text-slate-400" />
          </motion.div>
        )}
      </motion.div>
      <motion.div style={{ y: pull }}>{children}</motion.div>
    </div>
  )
}
