import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { decodePolyline } from '../../utils/polyline'
import { navigateToPointUrl } from '../../utils/navigation'

export interface FleetBus {
  busId: string
  busNumber: string
  lat: number
  lng: number
  status: string
  occupancy?: number
  capacity?: number
  updatedAt?: string
}

export interface FleetStop {
  name: string
  lat: number
  lng: number
  kind?: 'start' | 'end' | 'stop'
}

// OpenStreetMap raster tiles — a real street map with no API key, which is
// what lets this render on a fresh checkout instead of a configuration
// warning. Google Maps stays in use on the pages that need Places/Directions
// (RouteBuilder); this one only has to plot points on streets.
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// Bus numbers, statuses and stop names are admin-entered free text that ends
// up inside marker and popup HTML, so every interpolation is escaped. Leaflet
// takes HTML strings here, not nodes, so there is no framework escaping to
// lean on.
const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c])
}

function busIcon(bus: FleetBus) {
  // A div icon rather than an image marker: the emoji is the marker, sitting
  // on a white pill so it stays legible over any tile underneath.
  return L.divIcon({
    className: 'cmis-bus-marker',
    html: `<div class="cmis-bus-pin"><span class="cmis-bus-emoji">🚌</span><span class="cmis-bus-label">${esc(bus.busNumber)}</span></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

const STOP_COLORS: Record<string, string> = {
  start: '#059669',
  end: '#dc2626',
  stop: '#0091dc',
}

function stopIcon(stop: FleetStop) {
  const color = STOP_COLORS[stop.kind ?? 'stop']
  return L.divIcon({
    className: 'cmis-stop-marker',
    html: `<span class="cmis-stop-dot" style="background:${color}"></span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function popupHtml(bus: FleetBus) {
  const occupancy =
    bus.occupancy != null && bus.capacity != null
      ? `<div class="cmis-pop-row">Occupancy <b>${bus.occupancy}/${bus.capacity}</b></div>`
      : ''
  const seen = bus.updatedAt
    ? `<div class="cmis-pop-row">Last ping ${new Date(bus.updatedAt).toLocaleTimeString()}</div>`
    : ''
  return `<div class="cmis-pop"><div class="cmis-pop-title">🚌 ${esc(bus.busNumber)}</div><div class="cmis-pop-row">Status <b>${esc(bus.status)}</b></div>${occupancy}${seen}</div>`
}

export default function FleetMap({
  buses,
  center,
  zoom = 12,
  onSelect,
  stops,
  encodedPolyline,
  onMapClick,
  emptyMessage = 'No buses are reporting a live position right now. Markers appear here once a driver starts a trip.',
}: {
  buses: FleetBus[]
  center: { lat: number; lng: number }
  zoom?: number
  onSelect?: (busId: string) => void
  stops?: FleetStop[]
  encodedPolyline?: string | null
  emptyMessage?: string
  onMapClick?: (lat: number, lng: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  // Only auto-fit the first time buses appear; refitting on every GPS ping
  // would yank the map out from under an admin who panned somewhere.
  const hasFitRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
      hasFitRef.current = false
    }
    // Center/zoom are the initial camera only — deliberately not reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Click-to-place, used by the Route Builder to drop stops. Kept in its own
  // effect with the latest handler so the map is never torn down to rebind it.
  const clickRef = useRef(onMapClick)
  clickRef.current = onMapClick
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handler = (e: L.LeafletMouseEvent) => clickRef.current?.(e.latlng.lat, e.latlng.lng)
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [])

  // The route (path + stops) is static relative to the live bus markers, so
  // it lives in its own layer and is only rebuilt when the route changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    routeLayerRef.current?.remove()
    const layer = L.layerGroup().addTo(map)
    routeLayerRef.current = layer

    const path = encodedPolyline ? decodePolyline(encodedPolyline) : []
    if (path.length > 1) {
      L.polyline(
        path.map((p) => [p.lat, p.lng] as [number, number]),
        { color: '#0091dc', weight: 4, opacity: 0.85 },
      ).addTo(layer)
    }

    for (const stop of stops ?? []) {
      L.marker([stop.lat, stop.lng], { icon: stopIcon(stop) })
        .addTo(layer)
        .bindPopup(
          `<div class="cmis-pop"><div class="cmis-pop-title">${esc(stop.name)}</div>` +
            `<a class="cmis-pop-nav" href="${navigateToPointUrl(stop)}" target="_blank" rel="noreferrer">Directions to here →</a></div>`,
        )
    }

    // Frame the route when there is no live bus to frame instead.
    const framePoints: [number, number][] = [
      ...path.map((p) => [p.lat, p.lng] as [number, number]),
      ...(stops ?? []).map((s) => [s.lat, s.lng] as [number, number]),
    ]
    if (!hasFitRef.current && buses.length === 0 && framePoints.length > 0) {
      hasFitRef.current = true
      map.fitBounds(L.latLngBounds(framePoints), { padding: [48, 48], maxZoom: 15 })
    }
    // buses is intentionally excluded: this layer must not rebuild on each ping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, encodedPolyline])

  // Reconcile markers against the current bus list: move the ones that are
  // still reporting, drop the ones that stopped.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const seen = new Set<string>()
    for (const bus of buses) {
      seen.add(bus.busId)
      const existing = markersRef.current.get(bus.busId)
      if (existing) {
        existing.setLatLng([bus.lat, bus.lng])
        existing.setIcon(busIcon(bus))
        existing.setPopupContent(popupHtml(bus))
      } else {
        const marker = L.marker([bus.lat, bus.lng], { icon: busIcon(bus) })
          .addTo(map)
          .bindPopup(popupHtml(bus))
        if (onSelect) marker.on('click', () => onSelect(bus.busId))
        markersRef.current.set(bus.busId, marker)
      }
    }

    for (const [busId, marker] of markersRef.current) {
      if (!seen.has(busId)) {
        marker.remove()
        markersRef.current.delete(busId)
      }
    }

    if (!hasFitRef.current && buses.length > 0) {
      hasFitRef.current = true
      if (buses.length === 1) {
        map.setView([buses[0].lat, buses[0].lng], 14)
      } else {
        map.fitBounds(L.latLngBounds(buses.map((b) => [b.lat, b.lng] as [number, number])), {
          padding: [48, 48],
          maxZoom: 15,
        })
      }
    }
  }, [buses, onSelect])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full rounded-2xl" />
      {buses.length === 0 && (
        // Deliberately does not invent positions for buses that are not
        // reporting — an invented pin on a bus-tracking map is worse than
        // an empty one.
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] rounded-b-2xl bg-white/90 px-4 py-3 text-center text-sm text-slate-600 backdrop-blur-sm">
          {emptyMessage}
        </div>
      )}
    </div>
  )
}
