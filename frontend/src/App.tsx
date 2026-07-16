import { useQuery } from '@tanstack/react-query'
import { Bus, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { api } from './services/api'

function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get('/health')).data,
    retry: 1,
  })

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/20 p-3">
            <Bus className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">CMIS</h1>
            <p className="text-sm text-slate-400">
              Campus Mobility Intelligence System
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-4 text-sm">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span className="text-slate-400">Checking backend…</span>
            </>
          ) : isError ? (
            <>
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-red-400">
                Backend unreachable — is it running on port 4100?
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">
                Backend connected · {data?.service} v{data?.version}
              </span>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Phase 1 · Project skeleton
        </p>
      </div>
    </div>
  )
}

export default App
