import { describe, expect, it } from 'vitest'
import { decodePolyline } from './polyline'

describe('decodePolyline', () => {
  // The worked example from Google's encoded polyline format documentation.
  it('decodes the reference vector from the format spec', () => {
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(points).toHaveLength(3)
    expect(points[0].lat).toBeCloseTo(38.5, 5)
    expect(points[0].lng).toBeCloseTo(-120.2, 5)
    expect(points[1].lat).toBeCloseTo(40.7, 5)
    expect(points[1].lng).toBeCloseTo(-120.95, 5)
    expect(points[2].lat).toBeCloseTo(43.252, 5)
    expect(points[2].lng).toBeCloseTo(-126.453, 5)
  })

  it('returns nothing for an empty path', () => {
    expect(decodePolyline('')).toEqual([])
  })
})
