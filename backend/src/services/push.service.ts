import { getMessaging } from 'firebase-admin/messaging'
import { getDb } from '../firebase/admin.js'
import { COLLECTIONS } from '../firebase/collections.js'
import type { Role } from '../types/role.js'

// Web push (FCM) is a best-effort side channel alongside the in-app
// notification doc + Socket.IO event — a closed tab or locked phone still
// gets the alert, which is the whole point of the tap-based liveness
// this app promises for a bus arriving at a stop. Every failure here is
// swallowed by the caller (createNotification) — a push delivery problem
// must never block the notification itself from being recorded.

interface TokenRef {
  uid: string
  token: string
}

function tokensFromDoc(uid: string, data: FirebaseFirestore.DocumentData | undefined): TokenRef[] {
  const tokens = (data?.fcmTokens as string[] | undefined) ?? []
  return tokens.map((token) => ({ uid, token }))
}

export async function getTokensForUids(uids: string[]): Promise<TokenRef[]> {
  const db = getDb()
  const docs = await Promise.all(uids.map((uid) => db.collection(COLLECTIONS.users).doc(uid).get()))
  return docs.flatMap((doc) => (doc.exists ? tokensFromDoc(doc.id, doc.data()) : []))
}

export async function getTokensForRole(role: Role): Promise<TokenRef[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.users).where('role', '==', role).get()
  return snap.docs.flatMap((doc) => tokensFromDoc(doc.id, doc.data()))
}

export async function getTokensForAdmins(): Promise<TokenRef[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.users).where('role', 'in', ['super_admin', 'transport_admin']).get()
  return snap.docs.flatMap((doc) => tokensFromDoc(doc.id, doc.data()))
}

export async function getAllTokens(): Promise<TokenRef[]> {
  const db = getDb()
  const snap = await db.collection(COLLECTIONS.users).get()
  return snap.docs.flatMap((doc) => tokensFromDoc(doc.id, doc.data()))
}

async function pruneToken(uid: string, token: string) {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.users).doc(uid)
  const doc = await ref.get()
  if (!doc.exists) return
  const tokens = (doc.data()?.fcmTokens as string[] | undefined) ?? []
  await ref.update({ fcmTokens: tokens.filter((t) => t !== token) })
}

export async function sendPush(refs: TokenRef[], title: string, body: string): Promise<void> {
  if (refs.length === 0) return
  const messaging = getMessaging()

  // sendEachForMulticast caps at 500 tokens per call.
  for (let i = 0; i < refs.length; i += 500) {
    const chunk = refs.slice(i, i + 500)
    const response = await messaging.sendEachForMulticast({
      tokens: chunk.map((r) => r.token),
      notification: { title, body },
      webpush: { fcmOptions: { link: '/' } },
    })
    response.responses.forEach((r, idx) => {
      if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
        pruneToken(chunk[idx]!.uid, chunk[idx]!.token).catch(() => {})
      }
    })
  }
}

export async function registerToken(uid: string, token: string): Promise<void> {
  const db = getDb()
  const ref = db.collection(COLLECTIONS.users).doc(uid)
  const doc = await ref.get()
  const tokens = (doc.data()?.fcmTokens as string[] | undefined) ?? []
  if (!tokens.includes(token)) {
    await ref.update({ fcmTokens: [...tokens, token] })
  }
}

export async function unregisterToken(uid: string, token: string): Promise<void> {
  await pruneToken(uid, token)
}
