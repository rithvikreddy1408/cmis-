import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  onIdTokenChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '../services/firebase'
import type { Role } from '../types'

interface AuthContextValue {
  user: User | null
  role: Role | null
  loading: boolean
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onIdTokenChanged (not onAuthStateChanged) so a token refresh after
    // role/claim changes also refreshes what we read here.
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const result = await firebaseUser.getIdTokenResult()
        setUser(firebaseUser)
        setRole((result.claims.role as Role | undefined) ?? null)
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function login(email: string, password: string, rememberMe: boolean) {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence,
    )
    await signInWithEmailAndPassword(auth, email, password)
    // Force a fresh token so newly-set custom claims are picked up immediately.
    await auth.currentUser?.getIdToken(true)
  }

  async function logout() {
    await signOut(auth)
  }

  async function forgotPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider
      value={{ user, role, loading, login, logout, forgotPassword }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
