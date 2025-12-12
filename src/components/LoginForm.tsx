'use client'

import { useState, useEffect } from 'react'
import { useGameStore } from '@/lib/game-state'
import { inputStyles } from '@/lib/styles'
import { FEATURE_FLAGS } from '@/lib/config'

// Component to load and colorize SVG
function ColoredSVG({ src, colorClass, className }: { src: string; colorClass: string; className?: string }) {
  const [svgContent, setSvgContent] = useState<string>('')

  // Map Tailwind color classes to hex values
  const colorMap: Record<string, string> = {
    'text-green-400': '#4ade80',
    'text-red-400': '#f87171',
    'text-blue-400': '#60a5fa',
    'text-purple-400': '#a78bfa',
  }

  // Extract just the color class from the colorClass prop (in case it contains other classes)
  const colorClassOnly = colorClass.split(' ').find(cls => cls.startsWith('text-')) || colorClass
  const fillColor = colorMap[colorClassOnly] || '#ffffff'

  useEffect(() => {
    fetch(src)
      .then((res) => res.text())
      .then((text) => {
        // Replace all fill attributes with the specified color
        let coloredSvg = text
          .replace(/fill="[^"]*"/g, `fill="${fillColor}"`)
          .replace(/fill='[^']*'/g, `fill='${fillColor}'`)
        
        // Add fill to path elements that don't have it
        coloredSvg = coloredSvg.replace(
          /<path([^>]*?)(?:\s+fill="[^"]*")?([^>]*?)>/g,
          (match, before, after) => {
            if (!match.includes('fill=')) {
              return `<path${before}${after} fill="${fillColor}">`
            }
            return match
          }
        )
        
        // Add fill to g elements that don't have it (for grouped paths)
        coloredSvg = coloredSvg.replace(
          /<g([^>]*?)(?:\s+fill="[^"]*")?([^>]*?)>/g,
          (match, before, after) => {
            if (!match.includes('fill=')) {
              return `<g${before}${after} fill="${fillColor}">`
            }
            return match
          }
        )
        
        setSvgContent(coloredSvg)
      })
      .catch((err) => console.error('Failed to load SVG:', err))
  }, [src, fillColor])

  if (!svgContent) return null

  return (
    <div
      className={`flex-shrink-0 ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{ width: '120px' }}
    />
  )
}

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
    <div className="min-h-dvh flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full space-y-8 px-4">
        <div>
          <h2 className="mt-6 text-center text-3xl font-semibold text-white tracking-tight">
            Light Gray RPG
          </h2>
          <p className="mt-3 text-center text-sm text-gray-400">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Character SVGs */}
        <div className="flex justify-center items-center gap-1 mt-4 mb-2">
          {isLogin ? (
            <>
              <ColoredSVG
                src="/img/svg/npc/char-archer.svg"
                colorClass="text-green-400"
                className="scale-90 scale-x-[-1]"
              />
              <ColoredSVG
                src="/img/svg/npc/char-commander.svg"
                colorClass="text-red-400"
              />
              <ColoredSVG
                src="/img/svg/npc/npc-guardian.svg"
                colorClass="text-blue-400"
                className="scale-90 scale-x-[-1]"
              />
            </>
          ) : (
            <ColoredSVG
              src="/img/svg/potion.svg"
              colorClass="text-purple-400"
            />
          )}
        </div>
        
        <form 
          className="mt-8 space-y-5" 
          onSubmit={isLogin ? handleSubmit : handleRegister}
        >
          <div className="space-y-2">
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

          <div className="pt-2">
            <button
              type="submit"
              className={inputStyles.button.primary}
            >
              {isLogin ? 'Sign in' : 'Create account'}
            </button>
          </div>

          <div className="text-center pt-2">
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
