import 'dotenv/config'
import * as Sentry from '@sentry/node'

// Gated entirely behind SENTRY_DSN — a no-op with no DSN set, same
// pattern as every other optional external credential in this project
// (Google Maps, FCM's VAPID key). Must be imported before anything else
// in the entry point so Sentry's instrumentation can hook in early.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  })
}
