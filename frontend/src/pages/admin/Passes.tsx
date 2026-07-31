import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import Banner from '../../components/ui/Banner'
import StudentPicker from '../../components/ui/StudentPicker'
import { TextField } from '../../components/ui/FormField'
import { passesApi } from '../../services/passes.api'
import { studentsApi } from '../../services/students.api'
import { settingsApi } from '../../services/settings.api'
import type { Student } from '../../types'

export default function Passes() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Student | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const { data: appSettings } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get })

  function notify(kind: 'success' | 'error', message: string) {
    setBanner({ kind, message })
    setTimeout(() => setBanner(null), 6000)
  }

  const { data: expiring } = useQuery({ queryKey: ['passes', 'expiring'], queryFn: passesApi.expiring })

  // Live data for the selected student — `selected` itself is just a snapshot
  // from the picker at click time, so status/card fields go stale after any
  // mutation. This query is what the UI actually renders from.
  const { data: current } = useQuery({
    queryKey: ['student', selected?.studentId],
    queryFn: () => studentsApi.get(selected!.studentId),
    enabled: Boolean(selected),
  })

  const { data: history } = useQuery({
    queryKey: ['passes', 'history', selected?.studentId],
    queryFn: () => passesApi.history(selected!.studentId),
    enabled: Boolean(selected),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['passes'] })
    queryClient.invalidateQueries({ queryKey: ['students'] })
    queryClient.invalidateQueries({ queryKey: ['student', selected?.studentId] })
  }

  const issueMutation = useMutation({
    mutationFn: () => passesApi.issue(selected!.studentId, expiryDate),
    onSuccess: () => {
      invalidate()
      notify('success', 'Pass issued.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const renewMutation = useMutation({
    mutationFn: () => passesApi.renew(selected!.studentId, expiryDate),
    onSuccess: () => {
      invalidate()
      notify('success', 'Pass renewed.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const revokeMutation = useMutation({
    mutationFn: () => passesApi.revoke(selected!.studentId),
    onSuccess: () => {
      invalidate()
      notify('success', 'Pass revoked.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-slate-100">Bus Pass Management</h1>

      {banner && <Banner kind={banner.kind} message={banner.message} />}

      <div className="mb-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-300">
          <TriangleAlert className="h-4 w-4 text-amber-400" />
          Expiring within 7 days ({expiring?.length ?? 0})
        </h2>
        <div className="overflow-hidden card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Roll No.</th>
                <th className="px-4 py-3">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {!expiring?.length ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Nothing expiring soon.
                  </td>
                </tr>
              ) : (
                expiring.map((s) => (
                  <tr key={s.studentId} className="border-b border-slate-800/60 text-slate-300 last:border-0">
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3">{s.rollNumber}</td>
                    <td className="px-4 py-3 text-amber-400">
                      {s.passExpiry ? new Date(s.passExpiry).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-w-xl space-y-4">
        <StudentPicker
          selected={selected}
          onSelect={(s) => {
            setSelected(s)
            if (!expiryDate && appSettings) {
              const d = new Date()
              d.setDate(d.getDate() + appSettings.defaultPassDurationDays)
              setExpiryDate(d.toISOString().slice(0, 10))
            }
          }}
        />

        {selected && (
          <div className="space-y-4 card p-5">
            <div>
              <p className="mb-1 text-sm text-slate-400">Current status</p>
              <p className="text-sm text-slate-200">
                {current?.passStatus ?? selected.passStatus}
                {(current?.passExpiry ?? selected.passExpiry)
                  ? ` — expires ${new Date((current?.passExpiry ?? selected.passExpiry)!).toLocaleDateString()}`
                  : ''}
              </p>
            </div>

            <TextField
              label="Expiry Date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />

            <div className="flex gap-2">
              <button
                onClick={() => issueMutation.mutate()}
                disabled={!expiryDate || issueMutation.isPending}
                className="flex-1 rounded-lg btn-success py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Issue
              </button>
              <button
                onClick={() => renewMutation.mutate()}
                disabled={!expiryDate || renewMutation.isPending}
                className="flex-1 rounded-lg btn-primary py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Renew
              </button>
              <button
                onClick={() => revokeMutation.mutate()}
                disabled={revokeMutation.isPending}
                className="flex-1 rounded-lg border border-red-800 py-2 text-sm text-red-400 hover:bg-red-950/30 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>

            {history && history.length > 0 && (
              <div>
                <p className="mb-2 text-sm text-slate-300">Pass history</p>
                <div className="space-y-1.5">
                  {history.map((p) => (
                    <div
                      key={p.passId}
                      className="flex justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-400"
                    >
                      <span>
                        Issued {new Date(p.issuedDate).toLocaleDateString()} → expires{' '}
                        {new Date(p.expiryDate).toLocaleDateString()}
                      </span>
                      <span
                        className={
                          p.status === 'active'
                            ? 'text-emerald-400'
                            : p.status === 'expired'
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }
                      >
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function extractError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string } } }
  return axiosErr.response?.data?.error ?? 'Something went wrong.'
}
