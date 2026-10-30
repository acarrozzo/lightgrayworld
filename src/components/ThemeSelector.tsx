'use client'

import { useCallback, useState } from 'react'
import { THEMES, resolveTheme } from '@/lib/theme/themes'
import { themeToCssVars } from '@/lib/theme/tokens'
import { themeNameColor } from '@/lib/theme/swatch'
import { useThemeStore } from '@/store/themeStore'
import ThemeDot from '@/components/ThemeDot'
import VitalBar from '@/components/game-interface/VitalBar'
import type { Theme } from '@/lib/theme/types'

/**
 * A theme's own colors, as inline custom properties.
 *
 * Lets the preview paint itself in the theme it represents while the rest of
 * the page stays in the selected one — the whole point of a preview. Computed
 * from the same `themeToCssVars` the generated stylesheet uses, so the preview
 * can never show a palette the application would not actually apply.
 */
function themeVars(theme: Theme): React.CSSProperties {
  return themeToCssVars(theme) as unknown as React.CSSProperties
}

/** Attack, Search and Rest are Explore's own (BASIC_ACTIONS); Look is coming back. */
const PREVIEW_ACTIONS = [
  { label: 'Attack', fill: 'fill-action-attack' },
  { label: 'Search', fill: 'fill-action-search' },
  { label: 'Rest', fill: 'fill-action-rest' },
  { label: 'Look', fill: 'fill-action-look' },
] as const

/**
 * A room as the game draws it, painted in one theme: the player line, a room
 * title and description, the two bars, the action buttons and two feed lines.
 * Big enough to judge a theme by, which ten small cards were not.
 */
function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <div
      style={themeVars(theme)}
      className="pointer-events-none overflow-hidden rounded-lg border border-line-subtle bg-surface-canvas text-fg-primary"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between bg-surface-panel px-3 py-1.5 text-[10px]">
        <span className="font-semibold text-fg-bright">You</span>
        <span className="text-stat-def tabular-nums">
          Lv. 12 <span className="font-semibold text-resource-xp">34%</span>
        </span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <p className="text-[13px] font-semibold text-world-grassy-field-title">Grassy Field</p>
        <p className="text-[11px] leading-snug text-fg-secondary">Tall grass in every direction. A dirt path runs north toward Red Town.</p>
        {/* The header's own bars, at the header's size. */}
        <div className="flex gap-2">
          <VitalBar kind="hp" size="fat" current={84} max={120} drain={false} className="min-w-0 flex-1" />
          <VitalBar kind="mp" size="fat" current={40} max={60} drain={false} className="min-w-0 flex-1" />
        </div>
        {/* The room's three buttons as Explore draws them, then Look to compare against. */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {PREVIEW_ACTIONS.map(({ label, fill }) => (
            <span key={label} className={`inline-flex h-7 items-center rounded-lg px-3 text-xs font-medium shadow-sm shadow-shadow ${fill}`}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-0.5 border-t border-line-subtle bg-surface-sunken/60 px-3 py-1.5 text-[10.5px]">
        <span className="text-status-success">You found 2 Feathers.</span>
        <span className="tabular-nums">
          <span className="text-stat-str">STR 31</span>
          <span className="text-fg-muted"> · </span>
          <span className="text-stat-dex">DEX 18</span>
          <span className="text-fg-muted"> · </span>
          <span className="text-stat-mag">MAG 22</span>
          <span className="text-fg-muted"> · </span>
          <span className="text-stat-def">DEF 27</span>
        </span>
      </div>
    </div>
  )
}

/**
 * One dot per theme, as a radio group. Left and right step through them.
 * 28px targets 2px apart: ten fit on one line on a 360px phone.
 * `onPeek` hears the theme under the pointer or focus, and null when both
 * leave the row, so a caller can name or preview it without applying it.
 */
function DotRow({
  themeId,
  onSelect,
  onPeek,
  autoFocus = false,
}: {
  themeId: string
  onSelect: (id: string) => void
  onPeek: (id: string | null) => void
  autoFocus?: boolean
}) {
  const onKeyDown = (event: React.KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const index = THEMES.findIndex((t) => t.id === themeId)
    const nextIndex = (index + delta + THEMES.length) % THEMES.length
    onSelect(THEMES[nextIndex].id)
    onPeek(THEMES[nextIndex].id)
    // Focus follows the selection, as in any radio group.
    event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[nextIndex]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Terminal theme"
      onKeyDown={onKeyDown}
      onMouseLeave={() => onPeek(null)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onPeek(null)
      }}
      className="flex flex-wrap items-center justify-center gap-0.5"
    >
      {THEMES.map((theme) => (
        <ThemeDot
          key={theme.id}
          theme={theme}
          isSelected={theme.id === themeId}
          autoFocus={autoFocus && theme.id === themeId}
          onSelect={onSelect}
          onHover={onPeek}
        />
      ))}
    </div>
  )
}

interface ThemeSelectorProps {
  /**
   * `dots` is the row on its own with the name beneath: the login screen,
   * where the picker should be an invitation rather than a form section, and
   * the gear menu. `preview` puts one room, painted in the theme under the
   * pointer, above the same row: the Settings tab.
   */
  variant?: 'dots' | 'preview'
  /**
   * Whether to save the choice to the signed-in account. Off on the login
   * screen, where there is no account yet — the device copy is enough, and the
   * selection is handed to registration so a new account inherits it.
   */
  persistToAccount?: boolean
  /** Focus the selected dot on mount, for a menu that has just opened. */
  autoFocus?: boolean
  className?: string
}

export default function ThemeSelector({
  variant = 'preview',
  persistToAccount = true,
  autoFocus = false,
  className = '',
}: ThemeSelectorProps) {
  const themeId = useThemeStore((state) => state.themeId)
  const setTheme = useThemeStore((state) => state.setTheme)
  const [peek, setPeek] = useState<string | null>(null)

  const select = useCallback(
    (id: string) => setTheme(id, { persistToAccount }),
    [setTheme, persistToAccount]
  )

  const current = resolveTheme(themeId)
  // Whatever the pointer is over, falling back to the selected one — so themes
  // can be browsed by name and look without committing.
  const shown = peek ? resolveTheme(peek) : current

  return (
    <div className={className}>
      {variant === 'preview' && (
        <div className="mb-3">
          <ThemePreview theme={shown} />
        </div>
      )}

      <DotRow themeId={themeId} onSelect={select} onPeek={setPeek} autoFocus={autoFocus} />

      {/* The name lives under the row so the dots stay a single tidy line. */}
      <p
        className="mt-2 text-center text-[11px] font-semibold leading-none transition-colors"
        style={{ color: themeNameColor(shown, current) }}
      >
        {shown.name}
      </p>
      {variant === 'preview' && (
        <p className="mx-auto mt-1.5 max-w-sm text-center text-[11px] leading-snug text-fg-muted">{shown.description}</p>
      )}
    </div>
  )
}
