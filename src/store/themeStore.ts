'use client'

import { create } from 'zustand'
import { DEFAULT_THEME_ID, isThemeId } from '@/lib/theme/themes'

/**
 * The selected terminal theme.
 *
 * Persistence has two tiers, deliberately:
 *
 *  - **Local storage** is the device-level memory. It is what the login screen
 *    reads before anyone has authenticated, what the inline script in the root
 *    layout applies before first paint, and what a new account inherits when it
 *    registers.
 *
 *  - **The `User.theme` column** is the account-level memory, so the choice
 *    follows a player to another browser. It is written on change and read on
 *    sign-in, at which point it overrides whatever the device had stored.
 *
 * Neither is authoritative over gameplay — a theme is presentation only — so a
 * failed write is logged and dropped rather than surfaced or retried.
 */

const STORAGE_KEY = 'lg:theme'

/** Shared with the pre-paint script in the root layout; keep the two in step. */
export function readStoredTheme(): string {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return isThemeId(stored) ? stored : DEFAULT_THEME_ID
  } catch {
    return DEFAULT_THEME_ID
  }
}

function writeStoredTheme(themeId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, themeId)
  } catch {
    // Private browsing, or storage disabled. The in-memory choice still works
    // for this session.
  }
}

/**
 * Paint the theme.
 *
 * The `.theme-transition` class is added for the length of the cross-fade and
 * then removed, so the transition rules in generated-themes.css do not sit on
 * every element for the rest of the session.
 */
function paintTheme(themeId: string, animate: boolean) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  if (animate) {
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 220)
  }

  root.setAttribute('data-theme', themeId)
}

type ThemeState = {
  themeId: string
  /** False until the stored preference has been read, to avoid a flash of default. */
  isHydrated: boolean
  /** Adopt the stored device preference. Safe to call more than once. */
  hydrate: () => void
  /** Change the theme and remember it, on this device and on the account. */
  setTheme: (themeId: string, options?: { persistToAccount?: boolean }) => void
  /** Adopt the theme stored on a freshly signed-in account. */
  adoptAccountTheme: (themeId: string | null | undefined) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeId: DEFAULT_THEME_ID,
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated) return
    const themeId = readStoredTheme()
    paintTheme(themeId, false)
    set({ themeId, isHydrated: true })
  },

  setTheme: (themeId, options) => {
    if (!isThemeId(themeId) || themeId === get().themeId) return

    paintTheme(themeId, true)
    writeStoredTheme(themeId)
    set({ themeId })

    if (options?.persistToAccount !== false) {
      void fetch('/api/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: themeId }),
      }).catch((error) => {
        // A signed-out player on the login screen is the normal case here.
        console.debug('Theme not saved to account:', error)
      })
    }
  },

  adoptAccountTheme: (themeId) => {
    if (!isThemeId(themeId) || themeId === get().themeId) return
    paintTheme(themeId, true)
    writeStoredTheme(themeId)
    set({ themeId })
  },
}))
