import { useEffect, useRef, useState } from 'react'
import { gpsApi } from '../services/gps.api'

const PING_INTERVAL_MS = 5_000

export type PublisherStatus = 'idle' | 'watching' | 'error'

export interface LastPosition {
  lat: number
  lng: number
  speed: number
  heading: number
}

interface PingPayload {
  latitude: number
  longitude: number
  speed: number
  heading: number
}

// Publishes the driver's live location to the backend while `enabled`.
// Backend enforces the real ~5s-per-bus rate limit; the client-side throttle
// here just avoids hammering it with every watchPosition callback (which can
// fire much more often than once per 5s on some devices).
export function useGeolocationPublisher(enabled: boolean) {
  const [status, setStatus] = useState<PublisherStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastPosition, setLastPosition] = useState<LastPosition | null>(null)
  const [tabHidden, setTabHidden] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const lastSentAt = useRef(0)
  // Bounded (size-1) retry buffer: a dropped ping (offline/network blip) is
  // retried once alongside the next successful reading rather than lost —
  // deliberately not a growing queue, since only the freshest position
  // matters for live tracking.
  const pendingRetry = useRef<PingPayload | null>(null)

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }

    if (!('geolocation' in navigator)) {
      setStatus('error')
      setError('Geolocation is not supported on this device/browser.')
      return
    }

    async function sendPing(payload: PingPayload) {
      if (pendingRetry.current) {
        const retry = pendingRetry.current
        pendingRetry.current = null
        gpsApi.ping(retry).catch(() => {
          // Give up on the stale retry — a fresher reading is already in flight.
        })
      }
      try {
        await gpsApi.ping(payload)
      } catch {
        pendingRetry.current = payload
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus('watching')
        setError(null)
        const { latitude, longitude, speed, heading } = pos.coords
        const position: LastPosition = {
          lat: latitude,
          lng: longitude,
          speed: speed ?? 0,
          heading: heading ?? 0,
        }
        setLastPosition(position)

        const now = Date.now()
        if (now - lastSentAt.current >= PING_INTERVAL_MS) {
          lastSentAt.current = now
          sendPing({ latitude, longitude, speed: speed ?? 0, heading: heading ?? 0 })
        }
      },
      (err) => {
        setStatus('error')
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable location access for this site in your browser settings.'
            : `Location error: ${err.message}`,
        )
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    function handleVisibility() {
      setTabHidden(document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled])

  // Screen Wake Lock — mitigates the #1 real-world failure mode (screen
  // locks, browser throttles/kills watchPosition in the background).
  // Best-effort: unsupported browsers just don't get this protection.
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release()
          return
        }
        setWakeLockActive(true)
        sentinel.addEventListener('release', () => setWakeLockActive(false))
      } catch {
        setWakeLockActive(false)
      }
    }
    acquire()

    function handleVisibility() {
      if (document.visibilityState === 'visible' && !sentinel) acquire()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      sentinel?.release().catch(() => {})
    }
  }, [enabled])

  return { status, error, lastPosition, tabHidden, wakeLockActive }
}
