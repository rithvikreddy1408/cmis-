import { useEffect, useRef } from 'react'
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps'

// Renders either an encoded Google polyline string or a raw lat/lng path.
// Imperative because @vis.gl/react-google-maps has no <Polyline> primitive —
// this mirrors the library's own documented pattern for raw Maps JS overlays.
export default function RoutePolyline({
  encodedPath,
  path,
  color = '#0091dc',
}: {
  encodedPath?: string | null
  path?: { lat: number; lng: number }[]
  color?: string
}) {
  const map = useMap()
  const geometryLibrary = useMapsLibrary('geometry')
  const polylineRef = useRef<google.maps.Polyline | null>(null)

  useEffect(() => {
    if (!map) return

    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 4,
      })
    }
    const polyline = polylineRef.current
    polyline.setMap(map)

    let resolvedPath: google.maps.LatLng[] | { lat: number; lng: number }[] | null = null
    if (encodedPath && geometryLibrary) {
      resolvedPath = geometryLibrary.encoding.decodePath(encodedPath)
    } else if (path && path.length > 0) {
      resolvedPath = path
    }

    if (resolvedPath) {
      polyline.setPath(resolvedPath)
    }

    return () => {
      polyline.setMap(null)
    }
  }, [map, geometryLibrary, encodedPath, path, color])

  return null
}
