import { useState, useCallback, useEffect } from 'react'

interface AuthUser {
  id: string
  email: string
  companyName?: string
}

interface UseAuthReturn {
  user: AuthUser | null
  token: string | null
  isSignedIn: boolean
  isLoading: boolean
  error: string | null
  signin: (email: string, companyName?: string) => Promise<void>
  signout: () => void
}

const TOKEN_KEY = 'swagger_jwt_token'
const USER_KEY = 'swagger_user'

/**
 * Validate JWT token structure and check expiration
 * Uses atob() for browser-compatible base64 decoding
 */
function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {return false}

    // Decode payload (second part) using atob for browser compatibility
    const payload = parts[1]
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)

    // Use atob if available (browser), fallback to Buffer if in Node.js
    let decoded: string
    if (typeof atob !== 'undefined') {
      decoded = atob(padded)
    } else if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(padded, 'base64').toString('utf-8')
    } else {
      return false
    }

    const data = JSON.parse(decoded) as { exp?: number }

    // Check expiration if present
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return false // Token expired
    }

    return true
  } catch {
    return false // Invalid token format
  }
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load token and user from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser = localStorage.getItem(USER_KEY)

      if (storedToken && isTokenValid(storedToken)) {
        setToken(storedToken)
      } else if (storedToken) {
        // Token exists but is invalid/expired—clear it
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch {
          // Invalid JSON, clear it
          localStorage.removeItem(USER_KEY)
        }
      }
    } catch (err) {
      console.warn('Failed to load auth from localStorage:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signin = useCallback(async (email: string, companyName?: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, companyName }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to sign in')
      }

      if (!data.token || !data.user) {
        throw new Error('Invalid response from signin endpoint')
      }

      // Validate user object has required fields
      if (!data.user.id || !data.user.email) {
        throw new Error('Invalid user data from signin endpoint')
      }

      // Update state first, then attempt to persist to localStorage
      // This ensures state is consistent even if localStorage write fails
      setToken(data.token)
      setUser(data.user)

      // Attempt to store in localStorage (non-critical if it fails)
      try {
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(USER_KEY, JSON.stringify(data.user))
      } catch (storageErr) {
        // localStorage quota exceeded or unavailable—token still in state (in-memory)
        console.warn('Failed to persist auth to localStorage:', storageErr)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setError(null)
  }, [])

  return {
    user,
    token,
    isSignedIn: Boolean(token) && Boolean(user),
    isLoading,
    error,
    signin,
    signout,
  }
}
