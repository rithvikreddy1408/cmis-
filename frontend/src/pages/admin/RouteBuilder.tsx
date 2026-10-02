import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, MapPin, Trash2, GripVertical, Save } from 'lucide-react'
import FleetMap from '../../components/maps/FleetMap'
import { TextField } from '../../components/ui/FormField'
import Banner from '../../components/ui/Banner'
import { routesApi } from '../../services/routes.api'
import { mapsApi } from '../../services/maps.api'
import type { LatLng, RouteStop } from '../../types'
import { SERVICE_AREA_CENTER } from '../../utils/mapDefaults'

const DEFAULT_CENTER: LatLng = SERVICE_AREA_CENTER

export default function RouteBuilder() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()

  const [routeName, setRouteName] = useState('')
  const [startPoint, setStartPoint] = useState('')
  const [startLocation, setStartLocation] = useState<LatLng | null>(null)
  const [destination, setDestination] = useState('')
  const [destinationLocation, setDestinationLocation] = useState<LatLng | null>(null)
  const [stops, setStops] = useState<RouteStop[]>([])
  const [distance, setDistance] = useState<number | null>(null)
  const [expectedTime, setExpectedTime] = useState<number | null>(null)
  const [polyline, setPolyline] = useState<string | null>(null)
  const [mapCenter, setMapCenter] = useState<LatLng>(DEFAULT_CENTER)
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [geocodingStart, setGeocodingStart] = useState(false)
  const [geocodingDest, setGeocodingDest] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  function notify(kind: 'success' | 'error', message: string) {
    setBanner({ kind, message })
    setTimeout(() => setBanner(null), 6000)
  }

  const { data: existing } = useQuery({
    queryKey: ['route', id],
    queryFn: () => routesApi.get(id!),
    enabled: isEditing,
  })

  useEffect(() => {
    if (existing) {
      setRouteName(existing.routeName)
      setStartPoint(existing.startPoint)
      setStartLocation(existing.startLocation)
      setDestination(existing.destination)
      setDestinationLocation(existing.destinationLocation)
      setStops(existing.stops)
      setDistance(existing.distance)
      setExpectedTime(existing.expectedTime)
      setPolyline(existing.polyline)
      if (existing.startLocation) setMapCenter(existing.startLocation)
    }
  }, [existing])

  async function handleGeocodeStart() {
    if (!startPoint.trim()) return
    setGeocodingStart(true)
    try {
      const result = await mapsApi.geocode(startPoint)
      setStartLocation({ lat: result.lat, lng: result.lng })
      setMapCenter({ lat: result.lat, lng: result.lng })
      notify('success', `Located: ${result.formattedAddress}`)
    } catch (err) {
      notify('error', extractError(err))
    } finally {
      setGeocodingStart(false)
    }
  }

  async function handleGeocodeDestination() {
    if (!destination.trim()) return
    setGeocodingDest(true)
    try {
      const result = await mapsApi.geocode(destination)
      setDestinationLocation({ lat: result.lat, lng: result.lng })
      notify('success', `Located: ${result.formattedAddress}`)
    } catch (err) {
      notify('error', extractError(err))
    } finally {
      setGeocodingDest(false)
    }
  }

  function handleMapClick(lat: number, lng: number) {
    setStops((prev) => [...prev, { name: `Stop ${prev.length + 1}`, lat, lng, order: prev.length }])
  }

  function updateStopName(index: number, name: string) {
    setStops((prev) => prev.map((s, i) => (i === index ? { ...s, name } : s)))
  }

  function removeStop(index: number) {
    setStops((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })))
  }

  function moveStop(index: number, direction: -1 | 1) {
    setStops((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((s, i) => ({ ...s, order: i }))
    })
  }

  async function handlePreview() {
    if (!startLocation || !destinationLocation) {
      notify('error', 'Locate both the start point and destination first.')
      return
    }
    setPreviewing(true)
    try {
      const origin = `${startLocation.lat},${startLocation.lng}`
      const dest = `${destinationLocation.lat},${destinationLocation.lng}`
      const waypoints = [...stops]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ lat: s.lat, lng: s.lng }))
      const result = await mapsApi.directions(origin, dest, waypoints)
      setPolyline(result.polyline)
      setDistance(result.distanceKm)
      setExpectedTime(result.durationMin)
      notify('success', `Route previewed: ${result.distanceKm} km, ~${result.durationMin} min.`)
    } catch (err) {
      notify('error', extractError(err))
    } finally {
      setPreviewing(false)
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        routeName,
        startPoint,
        destination,
        startLocation,
        destinationLocation,
        stops,
        distance,
        expectedTime,
        polyline,
      }
      return isEditing ? routesApi.update(id!, payload) : routesApi.create(payload)
    },
    onSuccess: () => navigate('/admin/routes'),
    onError: (err: unknown) => notify('error', extractError(err)),
  })

  function handleSave() {
    if (!routeName.trim() || !startPoint.trim() || !destination.trim()) {
      notify('error', 'Route name, start point, and destination are required.')
      return
    }
    saveMutation.mutate()
  }

  const sortedStops = [...stops].sort((a, b) => a.order - b.order)

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="flex h-[calc(100vh-3rem)] gap-4"
    >
      <div className="flex w-96 shrink-0 flex-col overflow-y-auto card p-5">
        <button
          onClick={() => navigate('/admin/routes')}
          className="mb-4 flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Routes
        </button>

        <h1 className="mb-4 text-lg font-semibold text-slate-900">
          {isEditing ? 'Edit Route' : 'New Route'}
        </h1>

        {banner && <Banner kind={banner.kind} message={banner.message} />}

        <div className="space-y-4">
          <TextField label="Route Name" value={routeName} onChange={(e) => setRouteName(e.target.value)} />

          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label="Start Point"
                  value={startPoint}
                  onChange={(e) => setStartPoint(e.target.value)}
                  placeholder="e.g. Main Gate, Campus"
                />
              </div>
              <button
                onClick={handleGeocodeStart}
                disabled={geocodingStart}
                aria-label="Locate start point on map"
                className="mb-0.5 rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {geocodingStart ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </button>
            </div>
            {startLocation && (
              <p className="mt-1 text-xs text-emerald-600">
                Located: {startLocation.lat.toFixed(5)}, {startLocation.lng.toFixed(5)}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label="Destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Tech Park"
                />
              </div>
              <button
                onClick={handleGeocodeDestination}
                disabled={geocodingDest}
                aria-label="Locate destination on map"
                className="mb-0.5 rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                {geocodingDest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </button>
            </div>
            {destinationLocation && (
              <p className="mt-1 text-xs text-emerald-600">
                Located: {destinationLocation.lat.toFixed(5)}, {destinationLocation.lng.toFixed(5)}
              </p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-slate-700">Stops ({sortedStops.length})</p>
              <span className="text-xs text-slate-600">Click the map to add</span>
            </div>
            <div className="space-y-2">
              {sortedStops.map((stop, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    value={stop.name}
                    onChange={(e) => updateStopName(i, e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none"
                  />
                  <button
                    onClick={() => moveStop(i, -1)}
                    disabled={i === 0}
                    className="text-slate-600 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStop(i, 1)}
                    disabled={i === sortedStops.length - 1}
                    className="text-slate-600 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button onClick={() => removeStop(i)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {sortedStops.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-600">
                  No stops yet
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handlePreview}
            disabled={previewing || !startLocation || !destinationLocation}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
          >
            {previewing && <Loader2 className="h-4 w-4 animate-spin" />}
            Preview Route
          </button>

          {(distance != null || expectedTime != null) && (
            <div className="flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-xs text-slate-600">Distance</p>
                <p className="text-slate-800">{distance != null ? `${distance} km` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-600">ETA</p>
                <p className="text-slate-800">{expectedTime != null ? `${expectedTime} min` : '—'}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Route
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl">
        <FleetMap
          center={mapCenter}
          buses={[]}
          stops={[
            ...(startLocation ? [{ name: 'Start', ...startLocation, kind: 'start' as const }] : []),
            ...sortedStops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, kind: 'stop' as const })),
            ...(destinationLocation
              ? [{ name: 'Destination', ...destinationLocation, kind: 'end' as const }]
              : []),
          ]}
          encodedPolyline={polyline}
          onMapClick={handleMapClick}
          emptyMessage="Click anywhere on the map to add a stop."
        />
      </div>
    </motion.div>
  )
}

function extractError(err: unknown): string {
  const axiosErr = err as { response?: { data?: { error?: string } } }
  return axiosErr.response?.data?.error ?? 'Something went wrong.'
}
