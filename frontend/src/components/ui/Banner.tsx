import { CheckCircle2, XCircle } from 'lucide-react'

export default function Banner({
  kind,
  message,
}: {
  kind: 'success' | 'error'
  message: string
}) {
  const isSuccess = kind === 'success'
  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        isSuccess
          ? 'border-emerald-900 bg-emerald-950/40 text-emerald-400'
          : 'border-red-900 bg-red-950/50 text-red-400'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  )
}
