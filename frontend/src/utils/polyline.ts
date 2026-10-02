// Google's encoded polyline algorithm, decoded locally.
//
// Routes are stored as an encoded polyline because the backend gets them from
// the Directions API. The Maps JS geometry library would normally decode it,
// but that requires a loaded Google Maps — and the fleet/track maps render on
// OpenStreetMap tiles with no API key. The format is a documented, stable
// encoding, so decoding it here keeps those maps independent of Google.
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0
      let shift = 0
      let byte: number
      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      // Low bit set means the value was negative before the zigzag encoding.
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 'lat') lat += delta
      else lng += delta
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }

  return points
}
