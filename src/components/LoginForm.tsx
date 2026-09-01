'use client'

import { useState, useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'
import ThemeSelector from '@/components/ThemeSelector'
import { useGameStore } from '@/lib/game-state'
import { inputStyles } from '@/lib/styles'
import { FEATURE_FLAGS } from '@/lib/config'
import { validateUsername } from '@/lib/sanitization'

/**
 * Loads an SVG and repaints it in a theme colour.
 *
 * The fill has to be a concrete value written into the markup, so it is read
 * from the live computed styles rather than looked up in a table of hex codes.
 * That means the artwork follows the selected theme, including a change made
 * while the login screen is open.
 */
function ColoredSVG({
  src,
  colorVar,
  className,
}: {
  src: string
  /** A theme custom property, e.g. `--status-success`. */
  colorVar: string
  className?: string
}) {
  const [svgContent, setSvgContent] = useState<string>('')
  const themeId = useThemeStore((state) => state.themeId)

  useEffect(() => {
    let cancelled = false

    const fillColor =
      getComputedStyle(document.documentElement).getPropertyValue(colorVar).trim() || '#ffffff'

    fetch(src)
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return
        let coloredSvg = text
          .replace(/fill="[^"]*"/g, `fill="${fillColor}"`)
          .replace(/fill='[^']*'/g, `fill='${fillColor}'`)

        coloredSvg = coloredSvg.replace(/<path([^>]*?)>/g, (match, attrs) =>
          match.includes('fill=') ? match : `<path${attrs} fill="${fillColor}">`
        )
        coloredSvg = coloredSvg.replace(/<g([^>]*?)>/g, (match, attrs) =>
          match.includes('fill=') ? match : `<g${attrs} fill="${fillColor}">`
        )

        setSvgContent(coloredSvg)
      })
      .catch((err) => console.error('Failed to load SVG:', err))

    return () => {
      cancelled = true
    }
    // Re-runs on theme change so the artwork is repainted, not left behind.
  }, [src, colorVar, themeId])

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
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const setLoading = useGameStore((s) => s.setLoading)
  const setError = useGameStore((s) => s.setError)
  const login = useGameStore((s) => s.login)
  const requireEmail = FEATURE_FLAGS.REQUIRE_EMAIL_ON_REGISTRATION
  const themeId = useThemeStore((state) => state.themeId)

  const handleUsernameChange = (value: string) => {
    setFormData({ ...formData, username: value })
    
    // Only validate during registration, not login
    if (!isLogin) {
      const validation = validateUsername(value)
      if (!validation.isValid) {
        setUsernameError(validation.error || 'Invalid username')
      } else {
        setUsernameError(null)
      }
    } else {
      setUsernameError(null)
    }
  }

  const handleAuth = async (e: React.FormEvent, isLogin: boolean) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate username before submission (only for registration)
    if (!isLogin) {
      const validation = validateUsername(formData.username)
      if (!validation.isValid) {
        setError(validation.error || 'Invalid username')
        setLoading(false)
        return
      }
    }

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
        // Whatever theme they were previewing becomes the account's.
        payload.theme = themeId
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

  // Reset username error when switching between login/register
  const handleToggleMode = () => {
    setIsLogin(!isLogin)
    setUsernameError(null)
    setError(null)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface-canvas bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--accent)_6%,transparent)_0%,transparent_70%)]">
      <div className="max-w-md w-full space-y-8 px-4">
        <div>
          <h2 className="mt-6 text-center text-2xl font-light text-fg-bright/90 tracking-[0.25em] uppercase">
            Light Gray RPG
          </h2>
          <p className="mt-3 text-center text-xs text-fg-muted tracking-wide">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Character SVGs */}
        <div className="flex justify-center items-center gap-1 mt-4 mb-2">
          {isLogin ? (
            <>
              <ColoredSVG
                src="/img/svg/npc/char-archer.svg"
                colorVar="--hue-green"
                className="scale-90 scale-x-[-1]"
              />
              <ColoredSVG
                src="/img/svg/npc/char-commander.svg"
                colorVar="--hue-red"
              />
              <ColoredSVG
                src="/img/svg/npc/npc-guardian.svg"
                colorVar="--hue-blue"
                className="scale-90 scale-x-[-1]"
              />
            </>
          ) : (
            <ColoredSVG
              src="/img/svg/potion.svg"
              colorVar="--hue-violet"
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
                onChange={(e) => handleUsernameChange(e.target.value)}
              />
              {usernameError && !isLogin && (
                <p className="mt-1 text-sm text-status-error">{usernameError}</p>
              )}
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
              onClick={handleToggleMode}
            >
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>

        {/*
          Theme picking before sign-in, kept deliberately small: a row of dots
          under the form rather than a panel beside it. The choice applies
          instantly, is remembered on this device, and — when signing up —
          becomes the new account's theme. Persisting to the account is off
          here because there is no account yet.
        */}
        <div className="mt-7 border-t border-line-subtle pt-4">
          <h2 className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-muted">
            Terminal Theme
          </h2>
          <ThemeSelector variant="dots" persistToAccount={false} className="mt-2.5" />
        </div>
      </div>
    </div>
  )
}
