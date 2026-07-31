import { useCallback, useEffect, useState } from 'react'
import { getToken, deleteToken } from 'firebase/messaging'
import { getAppMessaging } from '../services/firebase'
import { api } from '../services/api'

type Permission = 'unsupported' | 'default' | 'granted' | 'denied'

// Opt-in only — this never runs on its own. A permission prompt firing
// automatically on login is exactly the kind of thing that gets a site's
// notification permission pre-emptively denied forever by the browser.
export function usePushNotifications() {
  const [permission, setPermission] = useState<Permission>('default')
  const [registered, setRegistered] = useState(() => Boolean(localStorage.getItem('cmis:fcmToken')))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission as Permission)
  }, [])

  const enable = useCallback(async () => {
    setLoading(true)
    try {
      const messaging = await getAppMessaging()
      if (!messaging) {
        setPermission('unsupported')
        return
      }
      const result = await Notification.requestPermission()
      setPermission(result as Permission)
      if (result !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      })
      if (token) {
        await api.post('/auth/fcm-token', { token })
        localStorage.setItem('cmis:fcmToken', token)
        setRegistered(true)
      }
    } catch {
      setPermission(Notification.permission as Permission)
    } finally {
      setLoading(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setLoading(true)
    const token = localStorage.getItem('cmis:fcmToken')
    try {
      const messaging = await getAppMessaging()
      if (messaging) await deleteToken(messaging)
      if (token) await api.delete('/auth/fcm-token', { data: { token } })
    } catch {
      // Best-effort — the token will naturally expire server-side even if
      // this particular unregister call fails.
    } finally {
      localStorage.removeItem('cmis:fcmToken')
      setRegistered(false)
      setLoading(false)
    }
  }, [])

  return { permission, registered, loading, enable, disable }
}
