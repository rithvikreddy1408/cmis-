import { describe, expect, it } from 'vitest'
import { parseCorsOrigin } from '../../src/utils/corsOrigin.js'

const DEV = 'http://localhost:5173'

describe('parseCorsOrigin', () => {
  it('falls back to the dev origin when unset', () => {
    expect(parseCorsOrigin(undefined)).toEqual([DEV])
  })

  // The case that actually broke production: a host dashboard created the
  // variable with a blank value, which `?? default` does not catch. Splitting
  // that gave [''], which matches no origin, so every browser request was
  // blocked while the server still reported healthy.
  it('falls back when the value is empty or whitespace', () => {
    expect(parseCorsOrigin('')).toEqual([DEV])
    expect(parseCorsOrigin('   ')).toEqual([DEV])
    expect(parseCorsOrigin(',')).toEqual([DEV])
  })

  it('parses a single origin', () => {
    expect(parseCorsOrigin('https://cmis-62871.web.app')).toEqual(['https://cmis-62871.web.app'])
  })

  it('parses a comma-separated list and trims spacing', () => {
    expect(parseCorsOrigin('https://a.app, https://b.app')).toEqual([
      'https://a.app',
      'https://b.app',
    ])
  })

  it('tolerates a trailing slash, which browsers never send in Origin', () => {
    expect(parseCorsOrigin('https://cmis-62871.web.app/')).toEqual(['https://cmis-62871.web.app'])
  })

  it('drops blank entries rather than allowing an empty origin', () => {
    expect(parseCorsOrigin('https://a.app,,https://b.app')).toEqual([
      'https://a.app',
      'https://b.app',
    ])
  })
})
