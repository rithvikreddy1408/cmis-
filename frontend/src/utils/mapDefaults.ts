/**
 * Where every map opens before it has real coordinates to show.
 *
 * The transport service area is the Nagole / LB Nagar corridor in south-east
 * Hyderabad, so this point sits between the two — close enough that both are
 * on screen at {@link DEFAULT_MAP_ZOOM}. Kept in one place because an empty
 * fleet map, the route builder, and a student whose bus has not started its
 * trip yet must all open on the same region rather than three guesses.
 */
export const SERVICE_AREA_CENTER = { lat: 17.358, lng: 78.5555 } as const

/** Wide enough to hold Nagole through LB Nagar with surrounding context. */
export const DEFAULT_MAP_ZOOM = 13
