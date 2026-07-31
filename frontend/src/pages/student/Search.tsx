import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search as SearchIcon, Bus as BusIcon, MapPin, Loader2 } from 'lucide-react'
import { busesApi } from '../../services/buses.api'
import EmptyState from '../../components/ui/EmptyState'

export default function Search() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['buses', 'search', q],
    queryFn: () => busesApi.search(q || undefined),
  })

  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold text-slate-100">Search Bus</h1>

      <div className="relative mb-5 max-w-lg">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by bus number, route, destination, or driver..."
          className="w-full rounded-lg input py-2 pl-9 pr-3 text-sm text-slate-100"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={BusIcon}
          title={q ? `No buses match "${q}"` : 'No buses running yet'}
          message={q ? 'Try a bus number, route name, or driver instead.' : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((bus) => (
            <button
              key={bus.busId}
              onClick={() => navigate(`/student/track/${bus.busId}`)}
              className="card p-4 text-left transition hover:border-indigo-700 hover:bg-slate-900"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="rounded-lg bg-indigo-500/15 p-2">
                  <BusIcon className="h-4 w-4 text-indigo-400" />
                </div>
                <span className="font-semibold text-slate-100">{bus.busNumber}</span>
              </div>
              {bus.routeName && <p className="text-sm text-slate-400">{bus.routeName}</p>}
              {bus.destination && <p className="text-xs text-slate-400">→ {bus.destination}</p>}
              {bus.driverName && <p className="mt-1 text-xs text-slate-400">Driver: {bus.driverName}</p>}
              <div className="mt-2 flex items-center gap-1 text-xs text-indigo-400">
                <MapPin className="h-3 w-3" /> Track
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
