"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  type User,
} from "firebase/auth"
import { auth } from "@/lib/firebase"

interface AuthContextValue {
  user: User | null
  loading: boolean
  plan: 'free' | 'pro' | null
  subscriptionLoading: boolean
  signUp: (email: string, password: string, name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshSubscription: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<'free' | 'pro' | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  const refreshSubscription = useCallback(async () => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      setPlan(null)
      return
    }

    setSubscriptionLoading(true)
    try {
      const token = await currentUser.getIdToken(true)
      const res = await fetch('/api/subscription', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setPlan(data.plan)
      } else {
        setPlan('free')
      }
    } catch {
      setPlan('free')
    } finally {
      setSubscriptionLoading(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)

      if (!firebaseUser) {
        setPlan(null)
      }
    })
    return unsubscribe
  }, [])

  // Fetch subscription status when user is available
  useEffect(() => {
    if (user) {
      refreshSubscription()
    }
  }, [user, refreshSubscription])

  async function signUp(email: string, password: string, name: string) {
    const { user: newUser } = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    )
    await updateProfile(newUser, { displayName: name })
    // onAuthStateChanged doesn't fire for profile updates, so refresh manually
    setUser({ ...newUser, displayName: name } as User)
  }

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider)
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        plan,
        subscriptionLoading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        resetPassword,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
