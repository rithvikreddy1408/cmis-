import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Ticket, TriangleAlert, CheckCircle2, Send, Loader2 } from 'lucide-react'
import Banner from '../../components/ui/Banner'
import { studentsApi } from '../../services/students.api'

export default function Pass() {
  const [requested, setRequested] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const { data: student, isLoading } = useQuery({
    queryKey: ['students', 'me'],
    queryFn: studentsApi.me,
  })

  const renewMutation = useMutation({
    mutationFn: studentsApi.requestPassRenewal,
    onSuccess: () => {
      setRequested(true)
      setBanner({ kind: 'success', message: 'Renewal request sent to the transport admin.' })
    },
    onError: () => setBanner({ kind: 'error', message: 'Could not send request. Try again.' }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <h1 className="sr-only">Bus Pass</h1>
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  const hasPass = student?.passStatus && student.passStatus !== 'none'
  const statusColor =
    student?.passStatus === 'active'
      ? 'text-emerald-400'
      : student?.passStatus === 'expired'
        ? 'text-amber-400'
        : student?.passStatus === 'revoked'
          ? 'text-red-400'
          : 'text-slate-400'

  return (
    <div className="max-w-lg">
      <h1 className="mb-5 text-xl font-semibold text-slate-100">Bus Pass</h1>

      {banner && <Banner kind={banner.kind} message={banner.message} />}

      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/15 p-3">
            <Ticket className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <p className={`text-lg font-semibold ${statusColor}`}>
              {hasPass ? student!.passStatus : 'No pass issued'}
            </p>
            {student?.passExpiry && (
              <p className="text-sm text-slate-400">
                Expires {new Date(student.passExpiry).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>

        {student?.passStatus === 'active' && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Your pass is active. Show it at boarding if asked.
          </div>
        )}

        {(student?.passStatus === 'expired' || student?.passStatus === 'revoked' || !hasPass) && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-900 bg-amber-950/30 px-3 py-2 text-sm text-amber-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {!hasPass
              ? 'No pass has been issued to you yet. Contact your transport admin.'
              : 'Your pass needs renewal before you can board.'}
          </div>
        )}

        <button
          onClick={() => renewMutation.mutate()}
          disabled={renewMutation.isPending || requested}
          className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
        >
          {renewMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {requested ? 'Renewal Requested' : 'Request Renewal'}
        </button>
      </div>
    </div>
  )
}
