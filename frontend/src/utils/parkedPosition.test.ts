import { describe, expect, it } from 'vitest'
import { parkedPosition } from './parkedPosition'

const ROUTE = {
  startPoint: 'Kothapet',
  destination: 'Sreyas College',
  startLocation: { lat: 17.376, lng: 78.541 },
  destinationLocation: { lat: 17.355, lng: 78.594 },
}

const at = (hour: number) => new Date(2026, 9, 2, hour, 0, 0)

describe('parkedPosition', () => {
  it('parks at the destination through the working day', () => {
    for (const hour of [9, 12, 15]) {
      const r = parkedPosition(ROUTE, at(hour))
      expect(r?.place).toBe('destination')
      expect(r?.label).toBe('Sreyas College')
    }
  })

  it('parks at the start outside those hours', () => {
    for (const hour of [0, 8, 16, 20, 23]) {
      const r = parkedPosition(ROUTE, at(hour))
      expect(r?.place).toBe('start')
      expect(r?.label).toBe('Kothapet')
    }
  })

  it('treats 09:00 as inside and 16:00 as outside', () => {
    expect(parkedPosition(ROUTE, at(9))?.place).toBe('destination')
    expect(parkedPosition(ROUTE, at(16))?.place).toBe('start')
  })

  // Nothing is invented when the route has no coordinates to fall back on.
  it('returns null without the coordinate it would need', () => {
    expect(parkedPosition({ ...ROUTE, destinationLocation: null }, at(12))).toBeNull()
    expect(parkedPosition({ ...ROUTE, startLocation: null }, at(20))).toBeNull()
    expect(parkedPosition(null, at(12))).toBeNull()
    expect(parkedPosition(undefined, at(12))).toBeNull()
  })
})
