import { useQuery } from '@tanstack/react-query'
import { Loader2, TriangleAlert, Gauge, Navigation2 } from 'lucide-react'
import FleetMap, { type FleetStop } from '../../components/maps/FleetMap'
import { SERVICE_AREA_CENTER } from '../../utils/mapDefaults'
import { navigateToPointUrl } from '../../utils/navigation'
import { studentsApi } from '../../services/students.api'
import { busesApi } from '../../services/buses.api'
import { routesApi } from '../../services/routes.api'
import { gpsApi } from '../../services/gps.api'
import { useBusChannel } from '../../hooks/useBusChannel'

// Safety-net poll interval — Socket.IO (useBusChannel) is the primary path;
// this just re-syncs if the socket is momentarily disconnected.
const GPS_POLL_MS = 20_000

export default function Track() {
  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['students', 'me'],
    queryFn: studentsApi.me,
  })

  // A student tracks exactly one bus: the one assigned to them. The bus id is
  // resolved from their own record rather than from the URL, so there is no
  // path that asks for someone else's bus. The backend enforces the same rule
  // on /buses, /routes, /gps and the socket room — this just means the UI
  // never constructs a request it knows would be refused.
  const busId = student?.busAssigned ?? null

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
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
      </div>
    )
  }

  if (!busId) {
    return (
      <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="mb-2 flex items-center gap-2 text-amber-600">
          <TriangleAlert className="h-5 w-5" />
          <h1 className="text-lg font-semibold">No bus assigned</h1>
        </div>
        <p className="text-sm text-slate-600">
          You don't have a bus assigned yet. Contact your transport admin, or search for a bus
          once that feature is available.
        </p>
      </div>
    )
  }

  const center = gps
    ? { lat: gps.latitude, lng: gps.longitude }
    : (bus?.routeId && route?.startLocation) || SERVICE_AREA_CENTER

  const mapStops: FleetStop[] = [
    ...(route?.startLocation
      ? [{ name: route.startPoint, ...route.startLocation, kind: 'start' as const }]
      : []),
    ...[...(route?.stops ?? [])]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, kind: 'stop' as const })),
    ...(route?.destinationLocation
      ? [{ name: route.destination, ...route.destinationLocation, kind: 'end' as const }]
      : []),
  ]

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto card p-5">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{bus?.busNumber ?? 'Bus'}</h1>
          <p className="text-sm text-slate-600">{route?.routeName ?? 'No route assigned'}</p>
        </div>

        {gpsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Locating bus…
          </div>
        ) : gpsError || !gps ? (
          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            No live location yet. The driver hasn't started a trip.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live — updated {new Date(gps.updatedAt).toLocaleTimeString()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 flex items-center gap-1 text-xs text-slate-600">
                  <Gauge className="h-3.5 w-3.5" /> Speed
                </p>
                <p className="text-slate-800">{Math.round(gps.speed * 3.6)} km/h</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 flex items-center gap-1 text-xs text-slate-600">
                  <Navigation2 className="h-3.5 w-3.5" /> Heading
                </p>
                <p className="text-slate-800">{Math.round(gps.heading)}°</p>
              </div>
            </div>
          </>
        )}

        {mapStops.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-slate-700">
              Stops <span className="text-slate-500">— tap one for directions</span>
            </p>
            <div className="space-y-1.5">
              {mapStops.map((stop, i) => (
                <a
                  key={i}
                  href={navigateToPointUrl(stop)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          stop.kind === 'start'
                            ? '#059669'
                            : stop.kind === 'end'
                              ? '#dc2626'
                              : '#0091dc',
                      }}
                    />
                    <span className="truncate">{stop.name}</span>
                  </span>
                  <Navigation2 className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl">
        <FleetMap
          center={center}
          zoom={14}
          buses={
            gps && bus
              ? [
                  {
                    busId: bus.busId,
                    busNumber: bus.busNumber,
                    lat: gps.latitude,
                    lng: gps.longitude,
                    status: bus.status,
                    occupancy: bus.currentOccupancy,
                    capacity: bus.capacity,
                    updatedAt: gps.updatedAt,
                  },
                ]
              : []
          }
          stops={mapStops}
          encodedPolyline={route?.polyline}
          emptyMessage="Your bus isn't sharing a live location yet — it appears here as soon as your driver starts the trip."
        />
      </div>
    </div>
  )
}
