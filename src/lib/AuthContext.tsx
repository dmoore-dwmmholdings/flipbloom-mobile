import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { UserProfile } from './types'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isPro: boolean
  isMax: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isPro: false,
  isMax: false,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (u: User) => {
    try {
      const snap = await getDoc(doc(db, 'users', u.uid))
      if (snap.exists()) {
        setProfile({ uid: u.uid, ...snap.data() } as UserProfile)
      } else {
        setProfile({
          uid: u.uid,
          email: u.email ?? '',
          plan: 'free',
          credits: 0,
          deckCount: 0,
        })
      }
    } catch {
      setProfile({
        uid: u.uid,
        email: u.email ?? '',
        plan: 'free',
        credits: 0,
        deckCount: 0,
      })
    }
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user)
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) await fetchProfile(u)
      else setProfile(null)
      setLoading(false)
    })
  }, [])

  const isPro = profile?.plan === 'pro' || profile?.plan === 'max'
  const isMax = profile?.plan === 'max'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isPro, isMax, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
