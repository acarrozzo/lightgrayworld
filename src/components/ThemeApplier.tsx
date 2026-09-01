'use client'

import { useEffect } from 'react'
import { useGameStore } from '@/lib/game-state'
import { useThemeStore } from '@/store/themeStore'

/**
 * Keeps the applied theme in step with the device and the account.
 *
 * Two jobs, in order:
 *
 *  1. Adopt the device preference on mount. The `data-theme` attribute is
 *     already correct — the inline script in the root layout set it before
 *     first paint — so this only brings the React store into agreement, which
 *     is what makes the selectors render the right option as chosen.
 *
 *  2. On sign-in, adopt the theme stored on the account, which then wins over
 *     whatever this device had. Fetched separately rather than carried on the
 *     player payload: a theme is a private preference, and the player object is
 *     broadcast to everyone sharing a room.
 */
export default function ThemeApplier() {
  const hydrate = useThemeStore((state) => state.hydrate)
  const adoptAccountTheme = useThemeStore((state) => state.adoptAccountTheme)
  const isLoggedIn = useGameStore((state) => state.isLoggedIn)
  const token = useGameStore((state) => state.token)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!isLoggedIn || !token) return
    let cancelled = false

    fetch('/api/user/theme', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.theme) adoptAccountTheme(data.theme)
      })
      .catch(() => {
        // The device preference is already applied; leave it in place.
      })

    return () => {
      cancelled = true
    }
  }, [isLoggedIn, token, adoptAccountTheme])

  return null
}
