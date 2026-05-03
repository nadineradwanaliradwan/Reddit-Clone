import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react'
import { apiRequest } from '@/api/client'

export type User = {
  _id: string
  username: string
  email: string
  role: string
  avatar?: string
} | null

type AuthContextValue = {
  user: User
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setIsLoading(false)
      return
    }

    try {
      const data = await apiRequest<{ success: boolean; user: any }>('/reddit/auth/me')
      if (data.success) {
        setUser({
          ...data.user,
          avatar: `https://picsum.photos/seed/${data.user.username}/100/100`
        })
      }
    } catch (err) {
      console.error('Failed to fetch user', err)
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiRequest<{ success: boolean; accessToken: string; refreshToken: string; user: any }>(
      '/reddit/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    )
    if (data.success) {
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      setUser({
        ...data.user,
        avatar: `https://picsum.photos/seed/${data.user.username}/100/100`
      })
    }
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const data = await apiRequest<{ success: boolean; accessToken: string; refreshToken: string; user: any }>(
      '/reddit/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      }
    )
    if (data.success) {
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      setUser({
        ...data.user,
        avatar: `https://picsum.photos/seed/${data.user.username}/100/100`
      })
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiRequest('/reddit/auth/logout', { method: 'POST' })
    } catch (err) {
      console.error('Logout failed', err)
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
