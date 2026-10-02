import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bus as BusIcon, Loader2, MapPin, TriangleAlert, Play, Square, Users } from 'lucide-react'
import { driversApi } from '../../services/drivers.api'
import { busesApi } from '../../services/buses.api'
import { tripsApi } from '../../services/trips.api'
import { useGeolocationPublisher } from '../../hooks/useGeolocationPublisher'
import { useBusChannel } from '../../hooks/useBusChannel'
import Banner from '../../components/ui/Banner'
import LiveDot from '../../components/ui/LiveDot'
import PullToRefresh from '../../components/ui/PullToRefresh'
import { useState } from 'react'

export default function DriverDashboard() {
  const queryClient = useQueryClient()
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [requestingLocation, setRequestingLocation] = useState(false)

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

  const { data: activeTrip, isLoading: tripLoading } = useQuery({
    queryKey: ['trips', 'active'],
    queryFn: tripsApi.active,
    refetchInterval: 10_000,
  })

  const publisher = useGeolocationPublisher(Boolean(activeTrip))
  useBusChannel(driver?.busAssigned)

  const startMutation = useMutation({
    mutationFn: tripsApi.start,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['bus'] })
      notify('success', 'Trip started. Sharing your location now.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  const endMutation = useMutation({
    mutationFn: (tripId: string) => tripsApi.end(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['bus'] })
      notify('success', 'Trip ended.')
    },
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  async function handleRefresh() {
    await queryClient.invalidateQueries({ queryKey: ['drivers', 'me'] })
    await queryClient.invalidateQueries({ queryKey: ['trips', 'active'] })
    await queryClient.invalidateQueries({ queryKey: ['bus'] })
  }

  function startTripAfterLocationPermission() {
    if (!navigator.geolocation) {
      notify('error', 'This browser does not support location sharing.')
      return
    }
    setRequestingLocation(true)
    navigator.geolocation.getCurrentPosition(
      () => {
        setRequestingLocation(false)
        startMutation.mutate()
      },
      (error) => {
        setRequestingLocation(false)
        notify(
          'error',
          error.code === error.PERMISSION_DENIED
            ? 'Location access is required to start a trip. Allow location for this site in your browser settings.'
            : `Could not get your location: ${error.message}`,
        )
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }

  if (driverLoading || tripLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <h1 className="sr-only">Driver Dashboard</h1>
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
      </div>
    )
  }

  if (!driver?.busAssigned) {
    return (
      <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="mb-2 flex items-center gap-2 text-amber-600">
          <TriangleAlert className="h-5 w-5" />
          <h1 className="text-lg font-semibold">No bus assigned</h1>
        </div>
        <p className="text-sm text-slate-600">
          You don't have a bus assigned yet. Contact your transport admin to get set up before
          starting a trip.
        </p>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="max-w-xl space-y-4">
      <div className="card p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-indigo-500/15 p-3">
            <BusIcon className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{bus?.busNumber ?? '—'}</h1>
            <p className="text-sm text-slate-600">Driver Dashboard — {driver.name}</p>
          </div>
        </div>

        {banner && <Banner kind={banner.kind} message={banner.message} />}

        {activeTrip ? (
          <>
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600">
              <LiveDot />
              Trip active since {new Date(activeTrip.startTime).toLocaleTimeString()}
            </div>

            {bus && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <Users className="h-4 w-4 text-indigo-600" />
                Onboard: {bus.currentOccupancy} / {bus.capacity}
              </div>
            )}

            {publisher.status === 'error' && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {publisher.error}
              </div>
            )}
            {publisher.tabHidden && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-600">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                This tab is in the background — some browsers pause location updates. Keep it in
                the foreground while driving.
              </div>
            )}
            {publisher.status === 'watching' && publisher.lastPosition && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <MapPin className="h-4 w-4 text-indigo-600" />
                Sharing location: {publisher.lastPosition.lat.toFixed(5)},{' '}
                {publisher.lastPosition.lng.toFixed(5)}
                {publisher.wakeLockActive && (
                  <span className="ml-auto text-xs text-emerald-600">Screen lock prevented</span>
                )}
              </div>
            )}

            <button
              onClick={() => endMutation.mutate(activeTrip.tripId)}
              disabled={endMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg btn-danger py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
            >
              {endMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              End Trip
            </button>
          </>
        ) : (
          <button
            onClick={startTripAfterLocationPermission}
            disabled={startMutation.isPending || requestingLocation}
            className="flex w-full items-center justify-center gap-2 rounded-lg btn-success py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
          >
            {startMutation.isPending || requestingLocation ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {requestingLocation ? 'Waiting for location permission…' : 'Allow location & Start Trip'}
          </button>
        )}
      </div>
    </div>
    </PullToRefresh>
  )
}

function extractError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string } } }
  return axiosErr.response?.data?.error ?? 'Something went wrong.'
}
