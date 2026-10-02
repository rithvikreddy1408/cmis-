import { type ReactNode } from 'react'
import { APIProvider, Map, type MapCameraChangedEvent } from '@vis.gl/react-google-maps'
import { AlertTriangle } from 'lucide-react'

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

// Muted light basemap matching the app surface. Deliberately low-contrast:
// the only things that should draw the eye on this map are the route line
// and the live bus markers, so POIs and transit overlays stay off.
const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f1f4f7' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5b6b7a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e3e8ed' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d8e8f2' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

export default function MapContainer({
  center,
  zoom = 13,
  onClick,
  onCenterChanged,
  children,
}: {
  center: { lat: number; lng: number }
  zoom?: number
  onClick?: (lat: number, lng: number) => void
  onCenterChanged?: (event: MapCameraChangedEvent) => void
  children?: ReactNode
}) {
  if (!MAPS_API_KEY) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-600" />
        <p className="text-sm text-amber-600">
          Google Maps API key not configured. Set{' '}
          <code className="rounded bg-slate-200 px-1">VITE_GOOGLE_MAPS_API_KEY</code> in{' '}
          <code className="rounded bg-slate-200 px-1">frontend/.env</code>.
        </p>
      </div>
    )
  }

  return (
    <APIProvider apiKey={MAPS_API_KEY} libraries={['geometry', 'places']}>
      <Map
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling="greedy"
        disableDefaultUI={false}
        styles={LIGHT_MAP_STYLE}
        onClick={(e) => {
          if (onClick && e.detail.latLng) {
            onClick(e.detail.latLng.lat, e.detail.latLng.lng)
          }
        }}
        onCenterChanged={onCenterChanged}
        className="h-full w-full rounded-2xl"
      >
        {children}
      </Map>
    </APIProvider>
  )
}
