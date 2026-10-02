import { HttpError } from '../middleware/errorHandler.js'
import type { GeocodeResult, DirectionsResult } from './maps.service.js'

// Keyless geocoding and routing, used when GOOGLE_MAPS_SERVER_KEY is absent.
//
// The rest of the app already renders OpenStreetMap tiles with no key, so the
// admin Route Builder being the one screen that demanded a Google key was an
// odd seam — an admin could not place a stop without provisioning billing.
// These providers close that gap.
//
// Both services ask for identification and are rate-limited: Nominatim wants a
// descriptive User-Agent and allows ~1 request/second, and the public OSRM
// instance is explicitly a demo host. That budget comfortably covers an admin
// building a route by hand, which is a rare, interactive action — it would not
// cover per-request traffic, which is why live ETA lookups stay on Google and
// simply report as unavailable without a key.
const USER_AGENT = 'CMIS-CampusMobility/0.1 (college bus tracking; contact via deployment admin)'

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

/** "lat,lng" as produced by the Route Builder, or a free-text place name. */
function parseLatLng(value: string): { lat: number; lng: number } | null {
  const m = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

export async function geocodeAddressOpen(address: string): Promise<GeocodeResult> {
  // A coordinate pair needs no lookup — the Route Builder sends these for
  // stops dropped directly on the map.
  const direct = parseLatLng(address)
  if (direct) {
    return { ...direct, formattedAddress: `${direct.lat}, ${direct.lng}` }
  }

  const url = new URL(NOMINATIM)
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new HttpError(502, 'Geocoding service is unavailable', 'GEOCODE_FAILED')
  }
  const body = (await res.json()) as { lat: string; lon: string; display_name: string }[]
  if (body.length === 0) {
    throw new HttpError(422, `Could not geocode address: "${address}"`, 'GEOCODE_FAILED')
  }

  return {
    lat: Number(body[0].lat),
    lng: Number(body[0].lon),
    formattedAddress: body[0].display_name,
  }
}

/** OSRM takes coordinates only, so any place name is geocoded first. */
async function toCoord(value: string): Promise<{ lat: number; lng: number }> {
  return parseLatLng(value) ?? (await geocodeAddressOpen(value))
}

export async function getDirectionsOpen(
  origin: string,
  destination: string,
  waypoints: string[],
): Promise<DirectionsResult> {
  const points = [origin, ...waypoints, destination]
  const coords: { lat: number; lng: number }[] = []
  for (const p of points) coords.push(await toCoord(p))

  // OSRM wants lng,lat ordering — the reverse of every other API here.
  const path = coords.map((c) => `${c.lng},${c.lat}`).join(';')
  const url = new URL(`${OSRM}/${path}`)
  url.searchParams.set('overview', 'full')
  // polyline6 would be more precise but the client decoder expects the
  // standard 1e5 precision that Google's format also uses.
  url.searchParams.set('geometries', 'polyline')

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new HttpError(502, 'Routing service is unavailable', 'DIRECTIONS_FAILED')
  }
  const body = (await res.json()) as {
    code: string
    routes?: { geometry: string; distance: number; duration: number }[]
  }
  if (body.code !== 'Ok' || !body.routes?.length) {
    throw new HttpError(422, `Could not compute directions (${body.code})`, 'DIRECTIONS_FAILED')
  }

  const route = body.routes[0]
  return {
    polyline: route.geometry,
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    durationMin: Math.round(route.duration / 60),
  }
}
