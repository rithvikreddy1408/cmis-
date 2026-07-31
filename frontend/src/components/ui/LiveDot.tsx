const COLORS = {
  emerald: { ping: 'bg-emerald-400', dot: 'bg-emerald-500' },
  indigo: { ping: 'bg-indigo-400', dot: 'bg-indigo-500' },
  red: { ping: 'bg-red-400', dot: 'bg-red-500' },
} as const

export default function LiveDot({ color = 'emerald' }: { color?: keyof typeof COLORS }) {
  const c = COLORS[color]
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${c.ping}`} />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
    </span>
  )
}
