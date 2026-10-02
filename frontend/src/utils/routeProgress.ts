export interface Point {
  lat: number
  lng: number
}

/**
 * Split a route at whatever point along it the bus is currently nearest.
 *
 * The bus never sits exactly on the drawn line — GPS drifts, and the line is a
 * road geometry sampled at intervals — so the split point is the perpendicular
 * projection onto the closest segment rather than the closest vertex. Snapping
 * to a vertex instead would make the highlight jump backwards and forwards by
 * up to a segment length on every ping.
 *
 * Returns the stretch already covered and the stretch still to come, each
 * including the projected position so the two meet exactly at the bus.
 */
export function splitRouteAtBus(
  path: Point[],
  bus: Point,
): { travelled: Point[]; remaining: Point[] } {
  if (path.length < 2) return { travelled: [], remaining: path }

  // Latitude degrees are a constant distance apart; longitude degrees shrink
  // towards the poles. Scaling lng by cos(lat) makes the comparison planar,
  // which is accurate enough over a city-sized route and avoids a full
  // geodesic distance per segment per ping.
  const k = Math.cos((bus.lat * Math.PI) / 180)
  const x = (p: Point) => p.lng * k
  const y = (p: Point) => p.lat

  let bestSegment = 0
  let bestT = 0
  let bestDistSq = Infinity
  let bestPoint: Point = path[0]

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]
    const b = path[i + 1]
    const abx = x(b) - x(a)
    const aby = y(b) - y(a)
    const lenSq = abx * abx + aby * aby

    // Degenerate segment (duplicate points) — treat it as the vertex itself.
    const t =
      lenSq === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((x(bus) - x(a)) * abx + (y(bus) - y(a)) * aby) / lenSq),
          )

    const px = x(a) + t * abx
    const py = y(a) + t * aby
    const dx = x(bus) - px
    const dy = y(bus) - py
    const distSq = dx * dx + dy * dy

    if (distSq < bestDistSq) {
      bestDistSq = distSq
      bestSegment = i
      bestT = t
      bestPoint = {
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng),
      }
    }
  }

  const travelled = [...path.slice(0, bestSegment + 1), bestPoint]
  // When the projection lands exactly on the far vertex, that vertex is already
  // the first remaining point — including it again would add a zero-length hop.
  const remainingStart = bestT >= 1 ? bestSegment + 2 : bestSegment + 1
  const remaining = [bestPoint, ...path.slice(remainingStart)]

  return { travelled, remaining }
}
