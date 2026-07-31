import { api } from './api'

export interface GeocodeResult {
  lat: number
  lng: number
  formattedAddress: string
}

export interface DirectionsResult {
  polyline: string
  distanceKm: number
  durationMin: number
}

export const mapsApi = {
  geocode: (address: string) =>
    api.get<GeocodeResult>('/maps/geocode', { params: { address } }).then((r) => r.data),

  directions: (origin: string, destination: string, waypoints: { lat: number; lng: number }[]) =>
    api
      .get<DirectionsResult>('/maps/directions', {
        params: {
          origin,
          destination,
          waypoints: waypoints.length
            ? waypoints.map((w) => `${w.lat},${w.lng}`).join('|')
            : undefined,
        },
      })
      .then((r) => r.data),
}
