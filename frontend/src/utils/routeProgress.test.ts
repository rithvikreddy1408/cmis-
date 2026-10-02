import { describe, expect, it } from 'vitest'
import { splitRouteAtBus } from './routeProgress'

// A straight west-to-east line at a constant latitude, so expected splits are
// easy to reason about by eye.
const LINE = [
  { lat: 17.35, lng: 78.5 },
  { lat: 17.35, lng: 78.6 },
  { lat: 17.35, lng: 78.7 },
]

describe('splitRouteAtBus', () => {
  it('splits at the bus when it sits partway along a segment', () => {
    const { travelled, remaining } = splitRouteAtBus(LINE, { lat: 17.35, lng: 78.55 })
    expect(travelled[travelled.length - 1].lng).toBeCloseTo(78.55, 4)
    expect(remaining[0].lng).toBeCloseTo(78.55, 4)
    // The two halves meet exactly at the bus, so the join is seamless.
    expect(travelled[travelled.length - 1]).toEqual(remaining[0])
    expect(remaining[remaining.length - 1].lng).toBeCloseTo(78.7, 4)
  })

  it('projects a bus that has drifted off the line back onto it', () => {
    // 0.01 degrees north of the route — GPS noise, not a detour.
    const { remaining } = splitRouteAtBus(LINE, { lat: 17.36, lng: 78.55 })
    expect(remaining[0].lat).toBeCloseTo(17.35, 4)
    expect(remaining[0].lng).toBeCloseTo(78.55, 4)
  })

  it('leaves the whole route remaining when the bus is at the start', () => {
    const { travelled, remaining } = splitRouteAtBus(LINE, { lat: 17.35, lng: 78.5 })
    expect(travelled).toHaveLength(2)
    expect(remaining[remaining.length - 1].lng).toBeCloseTo(78.7, 4)
  })

  it('leaves nothing remaining beyond the bus at the destination', () => {
    const { remaining } = splitRouteAtBus(LINE, { lat: 17.35, lng: 78.7 })
    expect(remaining).toHaveLength(1)
    expect(remaining[0].lng).toBeCloseTo(78.7, 4)
  })

  it('advances past the first segment once the bus is on the second', () => {
    const { travelled, remaining } = splitRouteAtBus(LINE, { lat: 17.35, lng: 78.65 })
    expect(travelled.map((p) => Number(p.lng.toFixed(2)))).toEqual([78.5, 78.6, 78.65])
    expect(remaining.map((p) => Number(p.lng.toFixed(2)))).toEqual([78.65, 78.7])
  })

  it('returns the path untouched when there is nothing to split', () => {
    expect(splitRouteAtBus([], { lat: 0, lng: 0 }).remaining).toEqual([])
    const single = [{ lat: 1, lng: 1 }]
    expect(splitRouteAtBus(single, { lat: 0, lng: 0 }).remaining).toEqual(single)
  })
})
