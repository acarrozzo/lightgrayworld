/**
 * A theme's identity as a colour, in two forms.
 *
 * `themeSwatch` is the single authored colour — see the `swatch` field on
 * `Theme` for why it is not derived. It is what a *list* of themes uses, where
 * nine dots sit side by side and the only job is telling them apart.
 *
 * `themeSwatchPie` splits the theme three ways: the ground it paints, the
 * accent that runs its chrome, and the hottest colour in its palette. It says
 * more about a single theme than one colour can, which suits a control that
 * shows only the active one.
 */

import type { Theme } from './types'
import { themeToCssVars } from './tokens'
import { ensureContrast } from './color'

/** The authored signature colour. Use where themes are shown as a set. */
export function themeSwatch(theme: Theme): string {
  return theme.swatch
}

/**
 * A theme's name, painted in its own accent, on a panel of the theme in use.
 *
 * Every picker shows names this way — it is the playful part — but the accent
 * was chosen against its own surfaces, not the current theme's. This lifts it
 * toward the current theme's bright text until it clears the large-text bar,
 * so a steel-blue name is still legible on a Solarized panel.
 */
export function themeNameColor(theme: Theme, on: Theme): string {
  return ensureContrast(theme.ui.accent, on.ui.surfacePanel, 3, on.ui.fgBright)
}

/** Ground, accent and attack as three slices. Use for a lone active-theme dot. */
export function themeSwatchPie(theme: Theme): string {
  const vars = themeToCssVars(theme)
  return `conic-gradient(from 210deg, ${vars['--surface-canvas']} 0 33%, ${vars['--accent']} 33% 66%, ${vars['--action-attack']} 66% 100%)`
}
