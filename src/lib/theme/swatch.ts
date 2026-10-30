/**
 * A theme's identity as a color.
 *
 * `themeSwatch` is the single authored color — see the `swatch` field on
 * `Theme` for why it is not derived. It is what a *list* of themes uses, where
 * nine dots sit side by side and the only job is telling them apart.
 */

import type { Theme } from './types'
import { ensureContrast } from './color'

/** The authored signature color. Use where themes are shown as a set. */
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
