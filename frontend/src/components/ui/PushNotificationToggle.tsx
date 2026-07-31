import { Bell, BellOff, Loader2 } from 'lucide-react'
import { usePushNotifications } from '../../hooks/usePushNotifications'

export default function PushNotificationToggle() {
  const { permission, registered, loading, enable, disable } = usePushNotifications()

  if (permission === 'unsupported') return null

  if (permission === 'denied') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-900 bg-amber-950/30 px-3 py-2 text-sm text-amber-400">
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
      className="mb-4 flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : registered ? (
        <Bell className="h-4 w-4 text-indigo-400" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      {registered
        ? 'Push notifications on for this device'
        : 'Enable push notifications on this device'}
    </button>
  )
}
