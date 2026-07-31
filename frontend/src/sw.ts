/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

precacheAndRoute(self.__WB_MANIFEST)

// Background push (FCM) — the whole reason this is a custom service
// worker instead of vite-plugin-pwa's auto-generated one. This is what
// lets a "bus 2 stops away" alert reach a closed tab / locked phone,
// which a Socket.IO event alone can never do.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (firebaseConfig.apiKey) {
  const app = initializeApp(firebaseConfig)
  const messaging = getMessaging(app)

  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'CMIS'
    self.registration.showNotification(title, {
      body: payload.notification?.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  })
}
