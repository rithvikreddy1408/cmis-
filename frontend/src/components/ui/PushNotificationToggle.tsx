import { Bell, BellOff, Loader2 } from 'lucide-react'
import { usePushNotifications } from '../../hooks/usePushNotifications'

export default function PushNotificationToggle() {
  const { permission, registered, loading, enable, disable } = usePushNotifications()

  if (permission === 'unsupported') return null

  if (permission === 'denied') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-600">
        <BellOff className="h-4 w-4 shrink-0" />
        Notifications are blocked in your browser settings — enable them there to get alerts even
        when this tab is closed.
      </div>
    )
  }

  return (
    <button
      onClick={registered ? disable : enable}
      disabled={loading}
      className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100/40 px-3 py-2 text-sm text-slate-700 transition hover:bg-black/5 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : registered ? (
        <Bell className="h-4 w-4 text-indigo-600" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      {registered
        ? 'Push notifications on for this device'
        : 'Enable push notifications on this device'}
    </button>
  )
}
