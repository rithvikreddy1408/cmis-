import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging'

// Firestore is never read directly from the browser — every page goes
// through the backend API, which holds the actual Admin SDK access. Only
// Auth is needed client-side, so that's all that's initialized here.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)

// Not every browser/context supports the Messaging SDK (Safari's support
// is partial, and it throws outright outside a secure/browser context) —
// isSupported() is the documented guard before ever calling getMessaging().
let messagingInstance: Messaging | null = null
export async function getAppMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance
  if (!(await isSupported())) return null
  messagingInstance = getMessaging(firebaseApp)
  return messagingInstance
}
