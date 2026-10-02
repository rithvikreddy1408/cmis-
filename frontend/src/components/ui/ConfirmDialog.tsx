import { motion } from 'framer-motion'
import { Loader2, TriangleAlert } from 'lucide-react'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  pending,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="card w-full max-w-sm p-6"
      >
        <div className="mb-3 flex items-center gap-2 text-red-600">
          <TriangleAlert className="h-5 w-5" />
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <p className="mb-6 text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-slate-700 transition hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-red-600 to-rose-700 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset] transition hover:brightness-110 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
