'use client'

import { useGameStore } from '@/lib/game-state'
import { useEffect, useState } from 'react'
import GameInterface from '@/components/GameInterface'
import LoginForm from '@/components/LoginForm'
import { isTokenValid, validateAndRefreshUser } from '@/lib/token-validation'

export default function Home() {
  const { isLoggedIn, isLoading, token, player, login, logout, setLoading } = useGameStore()
  const [isInitializing, setIsInitializing] = useState(true)

  // Validate stored token on app load
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('Initializing auth...', { token: !!token, isLoggedIn })
      
      if (!token) {
        console.log('No token found, showing login form')
        setIsInitializing(false)
        return
      }

      setLoading(true)
      
      try {
        // Check if token is valid
        if (!isTokenValid(token)) {
          console.log('Stored token is invalid, logging out')
          logout()
          setIsInitializing(false)
          return
        }

        console.log('Token is valid, validating with server...')
        
        // Validate token with server and get fresh user data
        const result = await validateAndRefreshUser(token)
        
        if (result.isValid && result.user) {
          console.log('Token validated, user logged in:', result.user.username)
          // User is already logged in via persistence, just ensure state is correct
          if (!isLoggedIn) {
            login(result.user, token)
          }
        } else {
          console.log('Token validation failed, logging out')
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
  }, []) // Only run once on mount

  if (isInitializing || isLoading) {
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