import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'

interface Profile {
  uid: string
  email: string
  displayName: string
  role: string
}

export default function ProfileCard({ title }: { title: string }) {
  const { user, role } = useAuth()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Profile>('/auth/me')).data,
  })

  return (
    <div className="max-w-lg card p-6">
      <h1 className="mb-1 text-xl font-semibold">{title}</h1>
      <p className="mb-4 text-sm text-slate-400">
        Signed in as <span className="text-slate-200">{user?.email}</span> ·
        role <span className="text-indigo-400">{role}</span>
      </p>

      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            <span className="text-slate-400">Loading profile from backend…</span>
          </>
        ) : isError ? (
          <>
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-red-400">Could not load /auth/me.</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-emerald-400">
              Backend confirms: {data?.displayName} ({data?.role})
            </span>
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        This is a Phase 2 placeholder — real dashboard content arrives in later phases.
      </p>
    </div>
  )
}
