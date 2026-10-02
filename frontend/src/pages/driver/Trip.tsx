import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Navigation, MapPin, Users, Loader2, Siren } from 'lucide-react'
import { driversApi } from '../../services/drivers.api'
import { busesApi } from '../../services/buses.api'
import { routesApi } from '../../services/routes.api'
import { tripsApi } from '../../services/trips.api'
import { useBusChannel } from '../../hooks/useBusChannel'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Banner from '../../components/ui/Banner'

function buildNavigationUrl(
  destination: string,
  destinationLocation: { lat: number; lng: number } | null,
  stops: { lat: number; lng: number; order: number }[],
) {
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set(
    'destination',
    destinationLocation ? `${destinationLocation.lat},${destinationLocation.lng}` : destination,
  )
  if (stops.length > 0) {
    const sorted = [...stops].sort((a, b) => a.order - b.order)
    url.searchParams.set('waypoints', sorted.map((s) => `${s.lat},${s.lng}`).join('|'))
  }
  url.searchParams.set('travelmode', 'driving')
  return url.toString()
}

export default function DriverTrip() {
  const [confirmingEmergency, setConfirmingEmergency] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  function notify(kind: 'success' | 'error', message: string) {
    setBanner({ kind, message })
    setTimeout(() => setBanner(null), 6000)
  }

  const { data: driver, isLoading: driverLoading } = useQuery({
    queryKey: ['drivers', 'me'],
    queryFn: driversApi.me,
  })

  const { data: bus } = useQuery({
    queryKey: ['bus', driver?.busAssigned],
    queryFn: () => busesApi.get(driver!.busAssigned!),
    enabled: Boolean(driver?.busAssigned),
  })

  const { data: route } = useQuery({
    queryKey: ['route', bus?.routeId],
    queryFn: () => routesApi.get(bus!.routeId!),
    enabled: Boolean(bus?.routeId),
  })

  const { data: activeTrip } = useQuery({
    queryKey: ['trips', 'active'],
    queryFn: tripsApi.active,
    refetchInterval: 10_000,
  })

  const { data: boardingFeed } = useQuery({
    queryKey: ['trip-boarding', activeTrip?.tripId],
    queryFn: () => tripsApi.boardingFeed(activeTrip!.tripId),
    enabled: Boolean(activeTrip),
    refetchInterval: 15_000,
  })

  useBusChannel(driver?.busAssigned)

  const emergencyMutation = useMutation({
    mutationFn: () => tripsApi.emergency(),
    onSuccess: () => {
      setConfirmingEmergency(false)
      notify('success', 'Emergency alert sent to transport admins.')
    },
    onError: () => {
      setConfirmingEmergency(false)
      notify('error', 'Could not send alert. Try again or contact admin directly.')
    },
  })

  if (driverLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <h1 className="sr-only">Trip & Navigation</h1>
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
      </div>
    )
  }

  const sortedStops = [...(route?.stops ?? [])].sort((a, b) => a.order - b.order)

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Trip & Navigation</h1>

      {banner && <Banner kind={banner.kind} message={banner.message} />}

      {!route ? (
        <p className="text-sm text-slate-600">No route assigned to your bus yet.</p>
      ) : (
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-900">{route.routeName}</p>
              <p className="text-sm text-slate-600">
                {route.startPoint} → {route.destination}
              </p>
            </div>
            <a
              href={buildNavigationUrl(route.destination, route.destinationLocation, route.stops)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg btn-primary px-3 py-2 text-sm font-medium text-white"
            >
              <Navigation className="h-4 w-4" />
              Navigate
            </a>
          </div>

          {sortedStops.length > 0 && (
            <div className="space-y-1.5 border-t border-slate-200 pt-3">
              {sortedStops.map((stop, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {stop.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-slate-700">
          <Users className="h-4 w-4" />
          <span className="text-sm font-medium">Boarding Feed</span>
        </div>
        {!activeTrip ? (
          <p className="text-sm text-slate-600">Start a trip to see live boardings.</p>
        ) : !boardingFeed?.length ? (
          <p className="text-sm text-slate-600">No one has boarded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {boardingFeed.map((entry, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="text-slate-800">
                  {entry.studentName}{' '}
                  <span className="text-slate-600">({entry.rollNumber})</span>
                </span>
                <span className="text-slate-600">
                  {new Date(entry.boardingTime).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setConfirmingEmergency(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 py-3 text-sm font-medium text-red-600 transition hover:bg-red-100"
      >
        <Siren className="h-4 w-4" />
        Emergency Alert
      </button>

      {confirmingEmergency && (
        <ConfirmDialog
          title="Send emergency alert?"
          message="This immediately notifies all transport admins that you need urgent help. Only use this for a real emergency."
          confirmLabel="Send Alert"
          pending={emergencyMutation.isPending}
          onConfirm={() => emergencyMutation.mutate()}
          onCancel={() => setConfirmingEmergency(false)}
        />
      )}
    </div>
  )
}
