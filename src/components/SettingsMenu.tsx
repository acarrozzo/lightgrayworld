'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LogOut, Settings as SettingsIcon } from 'lucide-react'
import { THEMES } from '@/lib/theme/themes'
import ThemeSelector from '@/components/ThemeSelector'

/**
 * The header's corner: one gear, and a small menu when you press it.
 *
 * The gear wears the connection as a pip on its shoulder, green or red, with
 * Refresh before it when the socket is gone. The menu holds the theme dots,
 * the connection in words, the way into the Settings tab, and Log out.
 * It replaced a gear, a connection dot and a theme dot standing side by side,
 * three shapes that crowded the corner.
 *
 * The menu is portalled to the body with fixed positioning rather than
 * absolutely positioned inside the header. Every ancestor of the header carries
 * `overflow-hidden` to keep the game's panes from scrolling the page, so an
 * in-flow popover would be clipped the moment it extended past the bar. Same
 * reasoning, and the same approach, as ActionFlyout.
 */

const GAP = 8
/** One 28px dot target per theme, 2px apart (ThemeSelector's row), plus the menu's own padding, so every dot sits on one line. */
const MENU_WIDTH = THEMES.length * 28 + (THEMES.length - 1) * 2 + 24

interface SettingsMenuProps {
  isConnected?: boolean
  onRefresh?: () => void
  /** Opens the Settings tab (never toggles it shut). */
  onOpenSettings?: () => void
  /** The Settings tab is the one open, so the gear stays lit. */
  settingsOpen?: boolean
  onLogout?: () => void
}

const ROW = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-fg-secondary transition-colors hover:bg-surface-raised/60 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 shrink-0 rounded-full ${connected ? 'bg-status-success shadow-[0_0_6px_color-mix(in_srgb,var(--status-success)_50%,transparent)]' : 'bg-status-error shadow-[0_0_6px_color-mix(in_srgb,var(--status-error)_50%,transparent)]'}`}
    />
  )
}

function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="shrink-0 px-2 py-1 text-xs font-medium rounded-md fill-accent transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.97]"
      aria-label="Refresh page"
      title="Refresh page"
    >
      Refresh
    </button>
  )
}

export default function SettingsMenu({ isConnected, onRefresh, onOpenSettings, settingsOpen = false, onLogout }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const status = isConnected === undefined ? null : isConnected ? 'Connected' : 'Disconnected'
  const label = status ? `Settings · ${status}` : 'Settings'

  /** Anchor to the trigger, right-aligned so it never runs off the edge. */
  const reposition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({
      top: rect.bottom + GAP,
      left: Math.max(GAP, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - GAP)),
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [isOpen, reposition])

  // Close on click-outside and Escape, and return focus to the trigger so
  // keyboard users are not dropped at the top of the document. Escape stops
  // here: it closes the menu, not the tab open behind it as well.
  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setIsOpen(false)
      buttonRef.current?.focus()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  /** A row's action, then the menu folds. */
  const run = (action?: () => void) => () => {
    setIsOpen(false)
    action?.()
  }

  const lit = isOpen || settingsOpen

  return (
    <>
      {isConnected === false && onRefresh && <RefreshButton onRefresh={onRefresh} />}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label}
        title={label}
        className={`relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
          lit ? 'bg-surface-raised text-fg-bright' : 'text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-bright'
        }`}
      >
        <SettingsIcon size={15} aria-hidden="true" />
        {/* The connection, on the gear's shoulder; ringed in the color behind it so it reads as a separate mark. */}
        {isConnected !== undefined && (
          <span
            aria-hidden="true"
            className={`absolute right-[3px] top-[3px] h-[7px] w-[7px] rounded-full ${lit ? 'shadow-[0_0_0_2px_var(--surface-raised)]' : 'shadow-[0_0_0_2px_var(--surface-panel)]'} ${isConnected ? 'bg-status-success' : 'bg-status-error'}`}
          />
        )}
      </button>

      {mounted &&
        isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Settings menu"
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-[60] overflow-hidden rounded-lg border border-line-subtle bg-surface-overlay shadow-xl shadow-shadow"
          >
            {/* Theme: the dots, the name of whichever is under the pointer */}
            <div className="px-3 py-2.5">
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-fg-muted">Theme</p>
              <ThemeSelector variant="dots" autoFocus />
            </div>

            {/* Connection, in words */}
            {status && (
              <div className="flex items-center gap-2 border-t border-line-subtle px-3 py-2 text-xs text-fg-secondary" role="status">
                <ConnectionDot connected={Boolean(isConnected)} />
                <span className="flex-1">{status}</span>
                {!isConnected && onRefresh && <RefreshButton onRefresh={onRefresh} />}
              </div>
            )}

            {/* Doors */}
            {(onOpenSettings || onLogout) && (
              <div className="flex flex-col gap-0.5 border-t border-line-subtle p-1.5">
                {onOpenSettings && (
                  <button type="button" onClick={run(onOpenSettings)} className={ROW}>
                    <SettingsIcon size={14} aria-hidden="true" />
                    All settings
                  </button>
                )}
                {onLogout && (
                  <button type="button" onClick={run(onLogout)} className={ROW}>
                    <LogOut size={14} aria-hidden="true" />
                    Log out
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
