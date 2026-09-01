'use client'

import { useCallback, useEffect, useRef } from 'react'
import { THEMES } from '@/lib/theme/themes'
import { themeToCssVars } from '@/lib/theme/tokens'
import { themeSwatch } from '@/lib/theme/swatch'
import { useThemeStore } from '@/store/themeStore'
import type { Theme } from '@/lib/theme/types'

/**
 * A theme's own colours, as inline custom properties.
 *
 * Lets a swatch paint itself in the theme it represents while the rest of the
 * page stays in the selected one — the whole point of a preview. Computed from
 * the same `themeToCssVars` the generated stylesheet uses, so a swatch can
 * never show a palette the application would not actually apply.
 */
function themeVars(theme: Theme): React.CSSProperties {
  return themeToCssVars(theme) as unknown as React.CSSProperties
}

/** A miniature of the interface, painted in one theme. */
function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div
      style={themeVars(theme)}
      className="pointer-events-none w-full overflow-hidden rounded-md border border-line-subtle bg-surface-canvas"
      aria-hidden="true"
    >
      {/* Title bar */}
      <div className="flex items-center gap-1 border-b border-line-subtle bg-surface-panel px-1.5 py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-action-attack" />
        <span className="h-1.5 w-1.5 rounded-full bg-resource-gold" />
        <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
      </div>
      {/* Room heading, vitals and a row of action chips */}
      <div className="space-y-1 p-1.5">
        <div className="h-1.5 w-2/3 rounded-full bg-world-grassy-field-title" />
        <div className="h-1 w-1/2 rounded-full bg-fg-muted" />
        <div className="flex gap-1 pt-0.5">
          <div className="h-1 flex-1 rounded-full bg-resource-hp" />
          <div className="h-1 flex-1 rounded-full bg-resource-mp" />
          <div className="h-1 flex-1 rounded-full bg-resource-xp" />
        </div>
        <div className="flex gap-1 pt-0.5">
          <div className="h-2 w-4 rounded-sm bg-action-attack" />
          <div className="h-2 w-4 rounded-sm bg-action-search" />
          <div className="h-2 w-4 rounded-sm bg-world-red-town" />
          <div className="h-2 flex-1 rounded-sm bg-surface-raised" />
        </div>
      </div>
    </div>
  )
}

/** The theme's sixteen ANSI colours, two rows of eight. */
function AnsiStrip({ theme }: { theme: Theme }) {
  const { terminal: t } = theme
  const row1 = [t.black, t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan, t.white]
  const row2 = [
    t.brightBlack, t.brightRed, t.brightGreen, t.brightYellow,
    t.brightBlue, t.brightMagenta, t.brightCyan, t.brightWhite,
  ]
  return (
    <div className="flex flex-col gap-px" aria-hidden="true">
      {[row1, row2].map((row, i) => (
        <div key={i} className="flex gap-px">
          {row.map((c, j) => (
            <span key={j} className="h-1.5 flex-1 first:rounded-l-sm last:rounded-r-sm" style={{ background: c }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * The minimal form: one dot per theme, the selected one named beneath.
 *
 * Used on the login screen, where the theme picker should be an invitation
 * rather than a form section — it sits under the sign-in button and must not
 * compete with it.
 */
function ThemeDots({
  themeId,
  onSelect,
  onKeyDown,
  className,
}: {
  themeId: string
  onSelect: (id: string) => void
  onKeyDown: (event: React.KeyboardEvent) => void
  className?: string
}) {
  const selected = THEMES.find((t) => t.id === themeId) ?? THEMES[0]

  return (
    <div className={className}>
      <div
        role="radiogroup"
        aria-label="Terminal theme"
        onKeyDown={onKeyDown}
        className="flex items-center justify-center gap-2"
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
              onClick={() => onSelect(theme.id)}
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

      {/* The name lives under the row so the dots stay a single tidy line. */}
      <p
        className="mt-2 text-center text-[11px] font-semibold transition-colors"
        style={{ color: themeToCssVars(selected)['--accent'] }}
      >
        {selected.name}
      </p>
    </div>
  )
}

interface ThemeSelectorProps {
  /**
   * `dots` is the minimal login form; `carousel` is a horizontal strip of
   * previews; `list` is the stacked form used in Settings.
   */
  variant?: 'carousel' | 'list' | 'dots'
  /**
   * Whether to save the choice to the signed-in account. Off on the login
   * screen, where there is no account yet — the device copy is enough, and the
   * selection is handed to registration so a new account inherits it.
   */
  persistToAccount?: boolean
  className?: string
}

export default function ThemeSelector({
  variant = 'list',
  persistToAccount = true,
  className = '',
}: ThemeSelectorProps) {
  const themeId = useThemeStore((state) => state.themeId)
  const setTheme = useThemeStore((state) => state.setTheme)
  const listRef = useRef<HTMLDivElement>(null)

  const select = useCallback(
    (id: string) => setTheme(id, { persistToAccount }),
    [setTheme, persistToAccount]
  )

  // Keep the selected card in view when the choice changes from elsewhere
  // (a keyboard arrow, or the account's stored theme arriving after sign-in).
  useEffect(() => {
    if (variant !== 'carousel') return
    const el = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [themeId, variant])

  /** Left/right arrows move through the strip, as a radio group should. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const index = THEMES.findIndex((t) => t.id === themeId)
    const next = THEMES[(index + delta + THEMES.length) % THEMES.length]
    select(next.id)
  }

  if (variant === 'dots') {
    return (
      <ThemeDots themeId={themeId} onSelect={select} onKeyDown={onKeyDown} className={className} />
    )
  }

  const isCarousel = variant === 'carousel'

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label="Terminal theme"
      onKeyDown={onKeyDown}
      className={
        isCarousel
          ? `flex gap-2 overflow-x-auto pb-1 ${className}`
          : `grid gap-2 sm:grid-cols-2 ${className}`
      }
    >
      {THEMES.map((theme) => {
        const isSelected = theme.id === themeId
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => select(theme.id)}
            className={`
              group shrink-0 rounded-lg border p-2 text-left transition-colors duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus
              ${isCarousel ? 'w-36' : 'w-full'}
              ${
                isSelected
                  ? 'border-accent bg-surface-selected'
                  : 'border-line-subtle bg-surface-panel hover:border-line-strong hover:bg-surface-hover'
              }
            `}
          >
            <ThemePreview theme={theme} />

            <div className="mt-1.5 flex items-baseline justify-between gap-1">
              {/* The name wears its own palette — the playful part. */}
              <span
                className="truncate text-xs font-semibold"
                style={{ color: themeToCssVars(theme)['--accent'] }}
              >
                {theme.name}
              </span>
              {isSelected && (
                <span className="shrink-0 text-[9px] uppercase tracking-wider text-accent">
                  On
                </span>
              )}
            </div>

            {!isCarousel && (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-fg-muted">
                {theme.description}
              </p>
            )}

            <div className="mt-1.5">
              <AnsiStrip theme={theme} />
            </div>
          </button>
        )
      })}
    </div>
  )
}
