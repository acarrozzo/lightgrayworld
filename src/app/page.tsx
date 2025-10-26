'use client'

import { useGameStore } from '@/lib/game-state'
import { useEffect, useState } from 'react'
import GameInterface from '@/components/GameInterface'
import LoginForm from '@/components/LoginForm'
import { isTokenValid, validateAndRefreshUser } from '@/lib/token-validation'

export default function Home() {
  const { isLoggedIn, isLoading, token, player, login, logout, setLoading } = useGameStore()
  const [isInitializing, setIsInitializing] = useState(true)
  const [isHydrated, setIsHydrated] = useState(false)

  // Wait for Zustand hydration to complete
  useEffect(() => {
    // Use requestAnimationFrame for faster hydration
    requestAnimationFrame(() => {
      setIsHydrated(true)
    })
  }, [])

  // Validate stored token on app load - only after hydration
  useEffect(() => {
    if (!isHydrated) return

    const initializeAuth = async () => {
      if (!token) {
        setIsInitializing(false)
        return
      }

      // Skip server validation if token is still valid locally
      if (isTokenValid(token)) {
        console.log('Token valid locally, skipping server validation')
        setIsInitializing(false)
        return
      }

      setLoading(true)
      
      try {
        // Only validate with server if token is expired/invalid
        const result = await validateAndRefreshUser(token)
        
        if (result.isValid && result.user) {
          if (!isLoggedIn) {
            login(result.user, result.newToken || token)
          }
        } else {
          logout()
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        logout()
      } finally {
        setLoading(false)
        setIsInitializing(false)
      }
    }

    initializeAuth()
  }, [isHydrated]) // Run after hydration

  if (isInitializing || isLoading || !isHydrated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-900">
      {isLoggedIn ? <GameInterface /> : <LoginForm />}
    </main>
  )
}