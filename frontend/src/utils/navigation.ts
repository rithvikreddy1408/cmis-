/**
 * Turn-by-turn navigation links.
 *
 * These are plain deep links, not an API: the URL opens the user's installed
 * maps app (or the web map on desktop) with directions already loaded. No key,
 * no quota, no billing — which is why navigation costs nothing even though the
 * rest of the app deliberately avoids Google services.
 *
 * The Google Maps URL scheme is used because it is the one both Android and
 * iOS resolve to an installed app, and falls back to the web on desktop.
 */
const MAPS_DIR = 'https://www.google.com/maps/dir/'

export interface NavPoint {
  lat: number
  lng: number
}

/**
 * Directions from wherever the user currently is to a single point — the
 * student walking to their stop. Origin is deliberately omitted so the maps
 * app uses the device's live location rather than a position this app guessed.
 */
export function navigateToPointUrl(point: NavPoint, mode: 'walking' | 'driving' = 'walking') {
  const url = new URL(MAPS_DIR)
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', `${point.lat},${point.lng}`)
  url.searchParams.set('travelmode', mode)
  return url.toString()
}

/**
 * A full run along the route: destination plus every stop as a waypoint, in
 * order — the driver's end-to-end trip.
 */
export function navigateRouteUrl(
  destination: string,
  destinationLocation: NavPoint | null,
  stops: (NavPoint & { order: number })[],
) {
  const url = new URL(MAPS_DIR)
  url.searchParams.set('api', '1')
  url.searchParams.set(
    'destination',
    destinationLocation ? `${destinationLocation.lat},${destinationLocation.lng}` : destination,
  )
  if (stops.length > 0) {
    const sorted = [...stops].sort((a, b) => a.order - b.order)
    // Google caps waypoints in a URL; beyond that the app silently drops the
    // tail, so the link is trimmed deliberately rather than quietly truncated.
    url.searchParams.set(
      'waypoints',
      sorted.slice(0, 9).map((s) => `${s.lat},${s.lng}`).join('|'),
    )
  }
  url.searchParams.set('travelmode', 'driving')
  return url.toString()
}
