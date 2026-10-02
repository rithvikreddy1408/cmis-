import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

export default function StatTile({
  label,
  value,
  icon: Icon,
  index = 0,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="card card-interactive p-5"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </motion.div>
  )
}
