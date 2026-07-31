import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, TriangleAlert, Gauge, Navigation2 } from 'lucide-react'
import MapContainer from '../../components/maps/MapContainer'
import BusMarker from '../../components/maps/BusMarker'
import RoutePolyline from '../../components/maps/RoutePolyline'
import StopMarker from '../../components/maps/StopMarker'
import { studentsApi } from '../../services/students.api'
import { busesApi } from '../../services/buses.api'
import { routesApi } from '../../services/routes.api'
import { gpsApi } from '../../services/gps.api'
import { useBusChannel } from '../../hooks/useBusChannel'

// Safety-net poll interval — Socket.IO (useBusChannel) is the primary path;
// this just re-syncs if the socket is momentarily disconnected.
const GPS_POLL_MS = 20_000

export default function Track() {
  const { busId: routeBusId } = useParams<{ busId?: string }>()

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['students', 'me'],
    queryFn: studentsApi.me,
    enabled: !routeBusId,
  })

  const busId = routeBusId ?? student?.busAssigned ?? null

  const { data: bus, isLoading: busLoading } = useQuery({
    queryKey: ['bus', busId],
    queryFn: () => busesApi.get(busId!),
    enabled: Boolean(busId),
  })

  const { data: route } = useQuery({
    queryKey: ['route', bus?.routeId],
    queryFn: () => routesApi.get(bus!.routeId!),
    enabled: Boolean(bus?.routeId),
  })

  const {
    data: gps,
    isError: gpsError,
    isLoading: gpsLoading,
  } = useQuery({
    queryKey: ['gps', busId],
    queryFn: () => gpsApi.get(busId!),
    enabled: Boolean(busId),
    refetchInterval: GPS_POLL_MS,
    retry: false,
  })

  useBusChannel(busId)

  if (studentLoading || busLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <h1 className="sr-only">Track Bus</h1>
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!busId) {
    return (
      <div className="max-w-lg rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <div className="mb-2 flex items-center gap-2 text-amber-400">
          <TriangleAlert className="h-5 w-5" />
          <h1 className="text-lg font-semibold">No bus assigned</h1>
        </div>
        <p className="text-sm text-slate-400">
          You don't have a bus assigned yet. Contact your transport admin, or search for a bus
          once that feature is available.
        </p>
      </div>
    )
  }

  const center = gps
    ? { lat: gps.latitude, lng: gps.longitude }
    : (bus?.routeId && route?.startLocation) || { lat: 13.0827, lng: 80.2707 }

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto card p-5">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">{bus?.busNumber ?? 'Bus'}</h1>
          <p className="text-sm text-slate-400">{route?.routeName ?? 'No route assigned'}</p>
        </div>

        {gpsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Locating bus…
          </div>
        ) : gpsError || !gps ? (
          <div className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-400">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            No live location yet. The driver hasn't started a trip.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live — updated {new Date(gps.updatedAt).toLocaleTimeString()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <p className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                  <Gauge className="h-3.5 w-3.5" /> Speed
                </p>
                <p className="text-slate-200">{Math.round(gps.speed * 3.6)} km/h</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <p className="mb-1 flex items-center gap-1 text-xs text-slate-400">
                  <Navigation2 className="h-3.5 w-3.5" /> Heading
                </p>
                <p className="text-slate-200">{Math.round(gps.heading)}°</p>
              </div>
            </div>
          </>
        )}

        {route && route.stops.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-slate-300">Stops</p>
            <div className="space-y-1.5">
              {[...route.stops]
                .sort((a, b) => a.order - b.order)
                .map((stop, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-1.5 text-sm text-slate-300"
                  >
                    {stop.name}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl">
        <MapContainer center={center} zoom={14}>
          {gps && <BusMarker position={{ lat: gps.latitude, lng: gps.longitude }} heading={gps.heading} label={bus?.busNumber} />}
          {route?.startLocation && (
            <StopMarker position={route.startLocation} label={route.startPoint} color="#10b981" />
          )}
          {route?.destinationLocation && (
            <StopMarker position={route.destinationLocation} label={route.destination} color="#ef4444" />
          )}
          {route?.polyline && <RoutePolyline encodedPath={route.polyline} />}
        </MapContainer>
      </div>
    </div>
  )
}
