/**
 * Flattening a `Theme` into the CSS custom properties the application reads.
 *
 * The variable names here are the stable contract. Components use them through
 * Tailwind utilities (`bg-surface-panel`, `text-fg-muted`, `text-action-attack`)
 * which are registered against these same variables in `globals.css`, or —
 * where the value is data-driven, like a room's authored colour — directly as
 * `style={{ color: 'var(--world-red-town)' }}`.
 *
 * Nothing outside this file needs to know how a value was produced: authored in
 * the theme, or derived from it.
 */

import type {
  RegionId,
  RegionPalette,
  ResolvedRegionPalette,
  Theme,
} from './types'
import { REGION_IDS } from './regions'
import { alpha, ensureContrast, mix } from './color'

/** `grassyField` -> `grassy-field`, so CSS vars stay conventionally kebab-cased. */
export function regionVarName(region: RegionId): string {
  return region.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/**
 * Fill in a region's unauthored slots from its identity colour.
 *
 * The derivation is what makes a fifteen-region world affordable across eight
 * themes: importing a terminal palette costs one colour per region, and the
 * launch themes then override only the slots where the automatic answer was
 * not good enough. Title and subtitle are pushed toward the theme's brightest
 * text until they clear a reading threshold, because a region's identity colour
 * is picked to be recognisable, not to be legible at body-text size.
 */
export function deriveRegionPalette(
  palette: RegionPalette,
  theme: Pick<Theme, 'ui'>
): ResolvedRegionPalette {
  const { base } = palette
  const { surfacePanel, surfaceCanvas, fgBright, fgMuted } = theme.ui

  const title = palette.title ?? ensureContrast(base, surfacePanel, 4.5, fgBright)
  const subtitle =
    palette.subtitle ?? ensureContrast(mix(title, fgMuted, 0.45), surfacePanel, 3.5, fgMuted)

  return {
    base,
    title,
    subtitle,
    icon: palette.icon ?? ensureContrast(base, surfacePanel, 3, fgBright),
    direction: palette.direction ?? ensureContrast(base, surfaceCanvas, 2.5, fgBright),
    accent: palette.accent ?? mix(base, fgBright, 0.25),
    tint: palette.tint ?? alpha(base, 0.1),
  }
}

/** Every region's palette for a theme, with derivation applied. */
export function resolveRegions(theme: Theme): Record<RegionId, ResolvedRegionPalette> {
  const out = {} as Record<RegionId, ResolvedRegionPalette>
  for (const id of REGION_IDS) {
    out[id] = deriveRegionPalette(theme.regions[id], theme)
  }
  return out
}

/**
 * The full variable set for a theme, as `{ '--surface-panel': '#161616', ... }`.
 *
 * Ordering is stable so generated CSS diffs stay readable.
 */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {}
  const { ui, game, terminal } = theme

  // --- Interface: surfaces -------------------------------------------------
  vars['--surface-canvas'] = ui.surfaceCanvas
  vars['--surface-sunken'] = ui.surfaceSunken
  vars['--surface-panel'] = ui.surfacePanel
  vars['--surface-raised'] = ui.surfaceRaised
  vars['--surface-overlay'] = ui.surfaceOverlay
  vars['--surface-hover'] = ui.surfaceHover
  vars['--surface-selected'] = ui.surfaceSelected
  vars['--surface-disabled'] = ui.surfaceDisabled
  vars['--scrim'] = ui.scrim
  vars['--shadow'] = ui.shadow

  // --- Interface: text -----------------------------------------------------
  vars['--fg-bright'] = ui.fgBright
  vars['--fg-primary'] = ui.fgPrimary
  vars['--fg-secondary'] = ui.fgSecondary
  vars['--fg-muted'] = ui.fgMuted
  vars['--fg-disabled'] = ui.fgDisabled
  vars['--fg-on-accent'] = ui.fgOnAccent

  // --- Interface: lines and emphasis ---------------------------------------
  vars['--line-subtle'] = ui.lineSubtle
  vars['--line-strong'] = ui.lineStrong
  vars['--line-focus'] = ui.lineFocus
  vars['--accent'] = ui.accent
  vars['--accent-hover'] = ui.accentHover
  vars['--accent-muted'] = ui.accentMuted

  // --- Game roles ----------------------------------------------------------
  for (const [k, v] of Object.entries(game.action)) vars[`--action-${k}`] = v
  for (const [k, v] of Object.entries(game.resource)) vars[`--resource-${k}`] = v
  for (const [k, v] of Object.entries(game.stat)) vars[`--stat-${k}`] = v
  for (const [k, v] of Object.entries(game.status)) vars[`--status-${k}`] = v
  for (const [k, v] of Object.entries(game.loot)) vars[`--loot-${k}`] = v
  for (const [k, v] of Object.entries(game.enemy)) vars[`--enemy-${k}`] = v
  for (const [k, v] of Object.entries(game.channel)) vars[`--channel-${k}`] = v
  for (const [k, v] of Object.entries(game.combat)) vars[`--combat-${k}`] = v
  for (const [k, v] of Object.entries(game.terrain)) vars[`--terrain-${k}`] = v
  for (const [k, v] of Object.entries(game.mood)) vars[`--mood-${k}`] = v
  for (const [k, v] of Object.entries(game.hue)) vars[`--hue-${k}`] = v

  // --- World regions -------------------------------------------------------
  const regions = resolveRegions(theme)
  for (const id of REGION_IDS) {
    const name = regionVarName(id)
    const p = regions[id]
    vars[`--world-${name}`] = p.base
    vars[`--world-${name}-title`] = p.title
    vars[`--world-${name}-subtitle`] = p.subtitle
    vars[`--world-${name}-icon`] = p.icon
    vars[`--world-${name}-direction`] = p.direction
    vars[`--world-${name}-accent`] = p.accent
    vars[`--world-${name}-tint`] = p.tint
  }

  // --- Terminal layer ------------------------------------------------------
  // Exposed as variables so the Color Lab can show the portable palette and a
  // future exporter can read it from the same place the app does.
  vars['--term-bg'] = terminal.background
  vars['--term-fg'] = terminal.foreground
  vars['--term-cursor'] = terminal.cursor
  vars['--term-selection-bg'] = terminal.selectionBackground
  vars['--term-selection-fg'] = terminal.selectionForeground

  const ansi: [string, string][] = [
    ['black', terminal.black],
    ['red', terminal.red],
    ['green', terminal.green],
    ['yellow', terminal.yellow],
    ['blue', terminal.blue],
    ['magenta', terminal.magenta],
    ['cyan', terminal.cyan],
    ['white', terminal.white],
    ['bright-black', terminal.brightBlack],
    ['bright-red', terminal.brightRed],
    ['bright-green', terminal.brightGreen],
    ['bright-yellow', terminal.brightYellow],
    ['bright-blue', terminal.brightBlue],
    ['bright-magenta', terminal.brightMagenta],
    ['bright-cyan', terminal.brightCyan],
    ['bright-white', terminal.brightWhite],
  ]
  for (const [name, value] of ansi) vars[`--ansi-${name}`] = value

  return vars
}
