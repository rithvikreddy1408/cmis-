const DEV_ORIGIN = 'http://localhost:5173'

/**
 * Parse the CORS_ORIGIN env var into the list of allowed origins.
 *
 * Deliberately treats an empty or whitespace-only value as "not configured"
 * rather than as "a list containing one empty origin". A host dashboard that
 * creates the variable with a blank value is indistinguishable from an unset
 * one as far as intent goes, but `??` alone only catches undefined — the
 * empty string would survive, split into [''], and match no origin at all,
 * silently blocking every browser request while the server still looks
 * healthy. Blank entries inside a real list are dropped for the same reason
 * ("a.com," should not also allow "").
 */
export function parseCorsOrigin(raw: string | undefined): string[] {
  const origins = (raw ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)

  return origins.length > 0 ? origins : [DEV_ORIGIN]
}
