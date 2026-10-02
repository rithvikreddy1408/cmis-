export interface LatLng {
  lat: number
  lng: number
}

/** Buses sit at the college through the working day and at the depot outside it. */
export const PARKED_AT_DESTINATION_FROM_HOUR = 9
export const PARKED_AT_DESTINATION_UNTIL_HOUR = 16

export interface ParkedPosition {
  point: LatLng
  /** Where the bus is expected to be, for labelling the marker. */
  place: 'destination' | 'start'
  label: string
}

/**
 * Where a bus that is not reporting GPS is *expected* to be.
 *
 * This is a schedule, not an observation: between 09:00 and 16:00 the fleet is
 * parked at the campus end of the route, and outside those hours at the start.
 * Callers must present the result as an expectation — a bus that has broken
 * down, been rerouted, or simply had its driver forget to start the trip will
 * still be drawn here, and a student who reads that as a live position is
 * being misled at exactly the moment it matters.
 *
 * Returns null when the route has no coordinates to fall back on, so nothing
 * is invented out of thin air.
 */
export function parkedPosition(
  route: { startPoint: string; destination: string; startLocation: LatLng | null; destinationLocation: LatLng | null } | null | undefined,
  now: Date = new Date(),
): ParkedPosition | null {
  if (!route) return null

  const hour = now.getHours()
  const atDestination =
    hour >= PARKED_AT_DESTINATION_FROM_HOUR && hour < PARKED_AT_DESTINATION_UNTIL_HOUR

  if (atDestination && route.destinationLocation) {
    return {
      point: route.destinationLocation,
      place: 'destination',
      label: route.destination,
    }
  }
  if (!atDestination && route.startLocation) {
    return {
      point: route.startLocation,
      place: 'start',
      label: route.startPoint,
    }
  }
  return null
}
