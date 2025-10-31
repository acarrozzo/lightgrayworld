'use client'

import { useState } from 'react'
import { useGameStore } from '@/lib/game-state'
import { inputStyles } from '@/lib/styles'
import { FEATURE_FLAGS } from '@/lib/config'

export default function LoginForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: ''
  })
  const { setLoading, setError, login } = useGameStore()
  const requireEmail = FEATURE_FLAGS.REQUIRE_EMAIL_ON_REGISTRATION

  const handleAuth = async (e: React.FormEvent, isLogin: boolean) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const trimmedEmail = formData.email.trim()
      const payload: Record<string, string> = {
        username: formData.username,
        password: formData.password,
      }

      if (!isLogin) {
        if (requireEmail || trimmedEmail) {
          payload.email = trimmedEmail
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || (isLogin ? 'Login failed' : 'Registration failed'))
      }

      const { player, token } = await response.json()
      login(player, token)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => handleAuth(e, true)
  const handleRegister = (e: React.FormEvent) => handleAuth(e, false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Light Gray RPG
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>
        
        <form 
          className="mt-8 space-y-6" 
          onSubmit={isLogin ? handleSubmit : handleRegister}
        >
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className={inputStyles.login.username}
                placeholder="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputStyles.login.password}
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            {!isLogin && (
              <div>
                <label htmlFor="email" className="sr-only">
                  Email {requireEmail ? '' : '(optional)'}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required={requireEmail}
                  className={inputStyles.login.email}
                  placeholder={requireEmail ? 'Email address' : 'Email address (optional)'}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            )}
            

          </div>

          <div>
            <button
              type="submit"
              className={inputStyles.button.primary}
            >
              {isLogin ? 'Sign in' : 'Create account'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className={inputStyles.button.link}
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
