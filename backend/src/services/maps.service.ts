import { HttpError } from '../middleware/errorHandler.js'
import {
  geocodeAddressOpen,
  getDirectionsOpen,
} from './openMaps.service.js'

const CACHE_TTL_MS = 30_000
const cache = new Map<string, { data: unknown; expiresAt: number }>()

function getCached<T>(key: string): T | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return hit.data as T
}

function setCached(key: string, data: unknown) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

function hasServerKey(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_SERVER_KEY)
}

function getServerKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY
  if (!key) {
    throw new HttpError(
      503,
      'Google Maps server key is not configured (GOOGLE_MAPS_SERVER_KEY)',
      'MAPS_NOT_CONFIGURED',
    )
  }
  return key
}

export interface GeocodeResult {
  lat: number
  lng: number
  formattedAddress: string
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const cacheKey = `geocode:${address}`
  const cached = getCached<GeocodeResult>(cacheKey)
  if (cached) return cached

  if (!hasServerKey()) {
    const open = await geocodeAddressOpen(address)
    setCached(cacheKey, open)
    return open
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', address)
  url.searchParams.set('key', getServerKey())

  const res = await fetch(url)
  const body = (await res.json()) as {
    status: string
    results: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[]
  }

  if (body.status !== 'OK' || body.results.length === 0) {
    throw new HttpError(422, `Could not geocode address: "${address}"`, 'GEOCODE_FAILED')
  }

  const result: GeocodeResult = {
    lat: body.results[0].geometry.location.lat,
    lng: body.results[0].geometry.location.lng,
    formattedAddress: body.results[0].formatted_address,
  }
  setCached(cacheKey, result)
  return result
}

export interface DirectionsResult {
  polyline: string
  distanceKm: number
  durationMin: number
}

export async function getDirections(
  origin: string,
  destination: string,
  waypoints: string[],
): Promise<DirectionsResult> {
  const cacheKey = `directions:${origin}|${destination}|${waypoints.join('|')}`
  const cached = getCached<DirectionsResult>(cacheKey)
  if (cached) return cached

  if (!hasServerKey()) {
    const open = await getDirectionsOpen(origin, destination, waypoints)
    setCached(cacheKey, open)
    return open
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', origin)
  url.searchParams.set('destination', destination)
  if (waypoints.length > 0) {
    url.searchParams.set('waypoints', waypoints.join('|'))
  }
  url.searchParams.set('key', getServerKey())

  const res = await fetch(url)
  const body = (await res.json()) as {
    status: string
    routes: {
      overview_polyline: { points: string }
      legs: { distance: { value: number }; duration: { value: number } }[]
    }[]
  }

  if (body.status !== 'OK' || body.routes.length === 0) {
    throw new HttpError(422, `Could not compute directions (${body.status})`, 'DIRECTIONS_FAILED')
  }

  const route = body.routes[0]
  const totalDistanceM = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0)
  const totalDurationS = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0)

  const result: DirectionsResult = {
    polyline: route.overview_polyline.points,
    distanceKm: Math.round((totalDistanceM / 1000) * 10) / 10,
    durationMin: Math.round(totalDurationS / 60),
  }
  setCached(cacheKey, result)
  return result
}

export interface EtaResult {
  distanceKm: number
  durationMin: number
}

export async function getEta(origin: string, destination: string): Promise<EtaResult> {
  const cacheKey = `eta:${origin}|${destination}`
  const cached = getCached<EtaResult>(cacheKey)
  if (cached) return cached

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', origin)
  url.searchParams.set('destinations', destination)
  url.searchParams.set('key', getServerKey())

  const res = await fetch(url)
  const body = (await res.json()) as {
    status: string
    rows: { elements: { status: string; distance: { value: number }; duration: { value: number } }[] }[]
  }

  const element = body.rows?.[0]?.elements?.[0]
  if (body.status !== 'OK' || !element || element.status !== 'OK') {
    throw new HttpError(422, 'Could not compute ETA', 'ETA_FAILED')
  }

  const result: EtaResult = {
    distanceKm: Math.round((element.distance.value / 1000) * 10) / 10,
    durationMin: Math.round(element.duration.value / 60),
  }
  setCached(cacheKey, result)
  return result
}
