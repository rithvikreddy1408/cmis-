import { useQuery } from '@tanstack/react-query'
import { Loader2, Clock, Route as RouteIcon } from 'lucide-react'
import { tripsApi } from '../../services/trips.api'

function formatDuration(startTime: string, endTime: string | null) {
  if (!endTime) return '—'
  const ms = new Date(endTime).getTime() - new Date(startTime).getTime()
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function DriverHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ['trips', 'history'],
    queryFn: tripsApi.history,
  })

  return (
    <div className="max-w-2xl">
      <h1 className="mb-5 text-xl font-semibold text-slate-100">Trip History</h1>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-slate-400">No completed trips yet.</p>
      ) : (
        <div className="space-y-2">
          {data.map((trip) => (
            <div
              key={trip.tripId}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-200">
                  {new Date(trip.startTime).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(trip.startTime).toLocaleTimeString()} –{' '}
                  {trip.endTime ? new Date(trip.endTime).toLocaleTimeString() : 'active'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDuration(trip.startTime, trip.endTime)}
                </span>
                <span className="flex items-center gap-1">
                  <RouteIcon className="h-3 w-3" /> {trip.distanceKm} km
                </span>
                <span>Peak onboard: {trip.peakOccupancy}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
