import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import '@fontsource-variable/inter'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import AppRouter from './routes/router'

// Gated behind VITE_SENTRY_DSN — a no-op with no DSN set, same pattern as
// every other optional external credential in this project.
//
// browserTracingIntegration is what actually turns this into a real-user
// Core Web Vitals pipeline (LCP/CLS/INP/FCP/TTFB attached to each pageload
// span) — it is not automatic just from calling Sentry.init(); the SDK
// keeps tracing opt-in to avoid shipping the extra bundle weight to
// projects that only want error capture.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  })
}

// Defaults matter more than any single query here: with React Query's stock
// settings every navigation treats cached data as stale on mount, so revisiting
// a page you saw seconds ago blanks to skeletons and refetches. Serving the
// cache first and revalidating in the background is what makes navigation feel
// instant. Live data stays fresh through the explicit refetchInterval on the
// queries that need it (GPS, trips, notifications) and Socket.IO pushes.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SocketProvider>
              <AppRouter />
            </SocketProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
