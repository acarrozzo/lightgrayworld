'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { THEMES } from '@/lib/theme/themes'
import { themeToCssVars } from '@/lib/theme/tokens'
import { themeSwatch, themeSwatchPie } from '@/lib/theme/swatch'
import { useThemeStore } from '@/store/themeStore'

/**
 * The header's theme control: one dot, and a row of dots when you press it.
 *
 * The trigger is painted in the *active* theme, so it doubles as an indicator —
 * you can see which theme is on without opening anything.
 *
 * The flyout is portalled to the body with fixed positioning rather than
 * absolutely positioned inside the header. Every ancestor of the header carries
 * `overflow-hidden` to keep the game's panes from scrolling the page, so an
 * in-flow popover would be clipped the moment it extended past the bar. Same
 * reasoning, and the same approach, as ActionFlyout.
 */

const GAP = 8
const FLYOUT_WIDTH = 232

export default function ThemeSwitcher({ className = '' }: { className?: string }) {
  const themeId = useThemeStore((state) => state.themeId)
  const setTheme = useThemeStore((state) => state.setTheme)

  const [isOpen, setIsOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const flyoutRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const active = THEMES.find((t) => t.id === themeId) ?? THEMES[0]
  // The name shown is whatever the pointer is over, falling back to the
  // selected one — so themes can be browsed by name without committing.
  const named = THEMES.find((t) => t.id === (hovered ?? themeId)) ?? active

  /** Anchor to the trigger, right-aligned so it never runs off the edge. */
  const reposition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({
      top: rect.bottom + GAP,
      left: Math.max(GAP, Math.min(rect.right - FLYOUT_WIDTH, window.innerWidth - FLYOUT_WIDTH - GAP)),
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
  // keyboard users are not dropped at the top of the document.
  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || flyoutRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
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

  /** Left/right step through the themes, as a radio group should. */
  const onFlyoutKeyDown = (event: React.KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const index = THEMES.findIndex((t) => t.id === themeId)
    setTheme(THEMES[(index + delta + THEMES.length) % THEMES.length].id)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Terminal theme: ${active.name}`}
        title={`Terminal theme: ${active.name}`}
        className={`
          h-4 w-4 shrink-0 rounded-full border transition-all duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus
          ${isOpen ? 'border-accent ring-2 ring-accent/40' : 'border-line-strong hover:scale-110 hover:border-accent'}
          ${className}
        `}
        style={{ background: themeSwatchPie(active) }}
      />

      {mounted &&
        isOpen &&
        position &&
        createPortal(
          <div
            ref={flyoutRef}
            role="dialog"
            aria-label="Terminal theme"
            style={{ top: position.top, left: position.left, width: FLYOUT_WIDTH }}
            className="fixed z-[60] rounded-lg border border-line-subtle bg-surface-overlay px-3 py-2.5 shadow-xl shadow-shadow"
            onMouseLeave={() => setHovered(null)}
          >
            <div
              role="radiogroup"
              aria-label="Terminal theme"
              onKeyDown={onFlyoutKeyDown}
              className="flex items-center justify-center gap-1.5"
            >
              {THEMES.map((theme) => {
                const isSelected = theme.id === themeId
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={theme.name}
                    title={theme.name}
                    tabIndex={isSelected ? 0 : -1}
                    autoFocus={isSelected}
                    onClick={() => setTheme(theme.id)}
                    onMouseEnter={() => setHovered(theme.id)}
                    onFocus={() => setHovered(theme.id)}
                    className={`
                      h-[18px] w-[18px] shrink-0 rounded-full border transition-all duration-150
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus
                      ${
                        isSelected
                          ? 'scale-110 border-accent ring-2 ring-accent/40'
                          : 'border-line-strong opacity-70 hover:scale-110 hover:opacity-100'
                      }
                    `}
                    style={{ background: themeSwatch(theme) }}
                  />
                )
              })}
            </div>

            <p
              className="mt-2 text-center text-[11px] font-semibold leading-none"
              style={{ color: themeToCssVars(named)['--accent'] }}
            >
              {named.name}
            </p>
          </div>,
          document.body
        )}
    </>
  )
}
