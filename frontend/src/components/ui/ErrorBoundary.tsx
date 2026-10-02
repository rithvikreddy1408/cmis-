import { Component, type ErrorInfo, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { TriangleAlert } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-full items-center justify-center p-6 text-slate-900">
          <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <TriangleAlert className="mx-auto mb-3 h-8 w-8 text-red-600" />
            <h1 className="mb-1 text-lg font-semibold">Something went wrong</h1>
            <p className="mb-4 text-sm text-slate-600">
              This screen hit an unexpected error. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
